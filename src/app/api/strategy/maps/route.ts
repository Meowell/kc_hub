import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canManageSharedResource, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { strategyMapSchema } from "@/lib/validators";

function forbidden() {
  return NextResponse.json({ error: "只有规划者或管理员可以管理攻略分块" }, { status: 403 });
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const activityId = new URL(request.url).searchParams.get("activityId");
  if (!activityId) return NextResponse.json({ error: "缺少活动 ID" }, { status: 400 });

  const maps = await prisma.strategyMap.findMany({
    where: { activityId },
    orderBy: [{ isDeleted: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      sections: {
        orderBy: [{ isDeleted: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { posts: { where: { isDeleted: false } } } },
          lockTags: {
            orderBy: { sortOrder: "asc" },
            include: { lockTag: true },
          },
          posts: {
            where: {
              isDeleted: false,
              OR: [{ status: "published" }, { userId: user.id }],
            },
            orderBy: { updatedAt: "desc" },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({
    maps: maps.map((map) => ({
      ...map,
      sections: map.sections.map((section) => ({
        ...section,
        postCount: section._count.posts,
        _count: undefined,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const parsed = strategyMapSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "海图字段不完整" }, { status: 400 });

  const activity = await prisma.activity.findUnique({
    where: { id: parsed.data.activityId },
    select: { id: true, status: true, isActive: true },
  });
  if (!activity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (!isActivityWritable(activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });

  const existing = await prisma.strategyMap.findUnique({
    where: { activityId_code: { activityId: activity.id, code: parsed.data.code } },
  });
  if (existing && !existing.isDeleted) {
    return NextResponse.json({ error: "该海图已经存在" }, { status: 409 });
  }

  const maxOrder = await prisma.strategyMap.aggregate({
    where: { activityId: activity.id, isDeleted: false },
    _max: { sortOrder: true },
  });
  const map = existing
    ? await prisma.strategyMap.update({
      where: { id: existing.id },
      data: {
        isDeleted: false,
        sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        isOpenForPosts: parsed.data.isOpenForPosts ?? false,
      },
    })
    : await prisma.strategyMap.create({
      data: {
        activityId: activity.id,
        code: parsed.data.code,
        sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        isOpenForPosts: parsed.data.isOpenForPosts ?? false,
      },
    });

  await writeAuditLog({ actorId: user.id, action: "strategy_map.create", entityType: "StrategyMap", entityId: map.id, activityId: map.activityId, after: map });
  return NextResponse.json({ map });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const parsed = strategyMapSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "缺少海图 ID 或字段不合法" }, { status: 400 });

  const existing = await prisma.strategyMap.findUnique({
    where: { id: parsed.data.id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing) return NextResponse.json({ error: "海图不存在" }, { status: 404 });
  if (existing.activityId !== parsed.data.activityId) return NextResponse.json({ error: "不能跨活动移动海图" }, { status: 400 });
  if (!isActivityWritable(existing.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });

  const affectedPosts = existing.isOpenForPosts && parsed.data.isOpenForPosts === false
    ? await prisma.strategyPost.count({
      where: { isDeleted: false, section: { strategyMapId: existing.id } },
    })
    : 0;
  const map = await prisma.$transaction(async (tx) => {
    const updated = await tx.strategyMap.update({
      where: { id: existing.id },
      data: {
        code: parsed.data.code,
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.isOpenForPosts !== undefined ? { isOpenForPosts: parsed.data.isOpenForPosts } : {}),
        ...(parsed.data.isDeleted !== undefined ? { isDeleted: parsed.data.isDeleted } : {}),
      },
    });
    if (updated.code !== existing.code) {
      const sections = await tx.strategySection.findMany({ where: { strategyMapId: updated.id }, select: { id: true, name: true } });
      await Promise.all(sections.map((section) => tx.strategyPost.updateMany({
        where: { sectionId: section.id },
        data: { phaseName: updated.code, title: `${updated.code} ${section.name}`, updatedById: user.id },
      })));
    }
    return updated;
  });

  await writeAuditLog({ actorId: user.id, action: "strategy_map.update", entityType: "StrategyMap", entityId: map.id, activityId: map.activityId, before: existing, after: map });
  return NextResponse.json({ map, affectedPosts });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少海图 ID" }, { status: 400 });

  const existing = await prisma.strategyMap.findUnique({
    where: { id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing) return NextResponse.json({ error: "海图不存在" }, { status: 404 });
  if (!isActivityWritable(existing.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });

  const affectedPosts = await prisma.strategyPost.count({
    where: { isDeleted: false, section: { strategyMapId: existing.id } },
  });
  const map = await prisma.strategyMap.update({
    where: { id },
    data: { isDeleted: true, isOpenForPosts: false },
  });
  await writeAuditLog({ actorId: user.id, action: "strategy_map.archive", entityType: "StrategyMap", entityId: map.id, activityId: map.activityId, before: existing, after: map });
  return NextResponse.json({ ok: true, map, affectedPosts });
}

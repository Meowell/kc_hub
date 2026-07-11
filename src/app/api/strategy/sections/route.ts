import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canManageSharedResource, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { strategySectionSchema } from "@/lib/validators";

function forbidden() {
  return NextResponse.json({ error: "只有规划者或管理员可以管理攻略分块" }, { status: 403 });
}

async function validateLockTags(activityId: string, lockTagIds: string[]) {
  const ids = [...new Set(lockTagIds)];
  const tags = ids.length
    ? await prisma.lockTag.findMany({ where: { id: { in: ids }, activityId } })
    : [];
  return tags.length === ids.length ? ids : null;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const strategyMapId = new URL(request.url).searchParams.get("strategyMapId");
  if (!strategyMapId) return NextResponse.json({ error: "缺少海图 ID" }, { status: 400 });
  const sections = await prisma.strategySection.findMany({
    where: { strategyMapId },
    orderBy: [{ isDeleted: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      lockTags: { orderBy: { sortOrder: "asc" }, include: { lockTag: true } },
      _count: { select: { posts: { where: { isDeleted: false } } } },
    },
  });
  return NextResponse.json({ sections });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const parsed = strategySectionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "分块字段不完整" }, { status: 400 });

  const strategyMap = await prisma.strategyMap.findUnique({
    where: { id: parsed.data.strategyMapId },
    include: { activity: { select: { id: true, status: true, isActive: true } } },
  });
  if (!strategyMap || strategyMap.isDeleted) return NextResponse.json({ error: "海图不存在" }, { status: 404 });
  if (!isActivityWritable(strategyMap.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  const tagIds = await validateLockTags(strategyMap.activityId, parsed.data.lockTagIds);
  if (!tagIds) return NextResponse.json({ error: "贴条不存在或不属于当前活动" }, { status: 400 });

  const existing = await prisma.strategySection.findUnique({
    where: { strategyMapId_name: { strategyMapId: strategyMap.id, name: parsed.data.name } },
  });
  if (existing && !existing.isDeleted) return NextResponse.json({ error: "该分块已经存在" }, { status: 409 });

  const maxOrder = await prisma.strategySection.aggregate({
    where: { strategyMapId: strategyMap.id, isDeleted: false },
    _max: { sortOrder: true },
  });
  const sortOrder = parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;
  const section = await prisma.$transaction(async (tx) => {
    const next = existing
      ? await tx.strategySection.update({ where: { id: existing.id }, data: { isDeleted: false, sortOrder } })
      : await tx.strategySection.create({ data: { strategyMapId: strategyMap.id, name: parsed.data.name, sortOrder } });
    await tx.strategySectionLockTag.deleteMany({ where: { sectionId: next.id } });
    if (tagIds.length) {
      await tx.strategySectionLockTag.createMany({
        data: tagIds.map((lockTagId, index) => ({ sectionId: next.id, lockTagId, sortOrder: index })),
      });
    }
    return tx.strategySection.findUniqueOrThrow({
      where: { id: next.id },
      include: { lockTags: { orderBy: { sortOrder: "asc" }, include: { lockTag: true } } },
    });
  });

  await writeAuditLog({ actorId: user.id, action: "strategy_section.create", entityType: "StrategySection", entityId: section.id, activityId: strategyMap.activityId, after: section });
  return NextResponse.json({ section });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const parsed = strategySectionSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "缺少分块 ID 或字段不合法" }, { status: 400 });

  const [existing, targetMap] = await Promise.all([
    prisma.strategySection.findUnique({
      where: { id: parsed.data.id },
      include: { strategyMap: { include: { activity: { select: { status: true, isActive: true } } } }, lockTags: true },
    }),
    prisma.strategyMap.findUnique({ where: { id: parsed.data.strategyMapId } }),
  ]);
  if (!existing || !targetMap || targetMap.isDeleted) return NextResponse.json({ error: "分块或目标海图不存在" }, { status: 404 });
  if (existing.strategyMap.activityId !== targetMap.activityId) return NextResponse.json({ error: "不能跨活动移动分块" }, { status: 400 });
  if (!isActivityWritable(existing.strategyMap.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  const tagIds = await validateLockTags(targetMap.activityId, parsed.data.lockTagIds);
  if (!tagIds) return NextResponse.json({ error: "贴条不存在或不属于当前活动" }, { status: 400 });

  const section = await prisma.$transaction(async (tx) => {
    const next = await tx.strategySection.update({
      where: { id: existing.id },
      data: {
        strategyMapId: targetMap.id,
        name: parsed.data.name,
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
        ...(parsed.data.isDeleted !== undefined ? { isDeleted: parsed.data.isDeleted } : {}),
      },
    });
    await tx.strategyPost.updateMany({
      where: { sectionId: next.id },
      data: { phaseName: targetMap.code, title: `${targetMap.code} ${next.name}`, updatedById: user.id },
    });
    await tx.strategySectionLockTag.deleteMany({ where: { sectionId: next.id } });
    if (tagIds.length) {
      await tx.strategySectionLockTag.createMany({
        data: tagIds.map((lockTagId, index) => ({ sectionId: next.id, lockTagId, sortOrder: index })),
      });
    }
    return tx.strategySection.findUniqueOrThrow({
      where: { id: next.id },
      include: { lockTags: { orderBy: { sortOrder: "asc" }, include: { lockTag: true } } },
    });
  });

  await writeAuditLog({ actorId: user.id, action: "strategy_section.update", entityType: "StrategySection", entityId: section.id, activityId: targetMap.activityId, before: existing, after: section });
  return NextResponse.json({ section });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) return forbidden();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少分块 ID" }, { status: 400 });
  const existing = await prisma.strategySection.findUnique({
    where: { id },
    include: { strategyMap: { include: { activity: { select: { status: true, isActive: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "分块不存在" }, { status: 404 });
  if (!isActivityWritable(existing.strategyMap.activity)) return NextResponse.json({ error: "活动已归档" }, { status: 403 });
  const affectedPosts = await prisma.strategyPost.count({ where: { sectionId: id, isDeleted: false } });
  const section = await prisma.strategySection.update({ where: { id }, data: { isDeleted: true } });
  await writeAuditLog({ actorId: user.id, action: "strategy_section.archive", entityType: "StrategySection", entityId: section.id, activityId: existing.strategyMap.activityId, before: existing, after: section });
  return NextResponse.json({ ok: true, section, affectedPosts });
}

import { NextResponse } from "next/server";

import { normalizeActivityId } from "@/lib/activity-scope";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditOwnedResource, getVisibleContentWhere, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { strategyPostSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));

  const posts = await prisma.strategyPost.findMany({
    where: getVisibleContentWhere({ activityId }),
    orderBy: [{ isPinned: "desc" }, { phaseName: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = strategyPostSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "攻略贴字段不完整" }, { status: 400 });
  }

  const activityId = normalizeActivityId(parsed.data.activityId);
  const activity = activityId
    ? await prisma.activity.findUnique({ where: { id: activityId }, select: { status: true, isActive: true } })
    : null;
  if (activityId && !activity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (!isActivityWritable(activity)) {
    return NextResponse.json({ error: "活动已归档，攻略档案只读" }, { status: 403 });
  }

  const post = await prisma.strategyPost.create({
    data: {
      userId: user.id,
      activityId,
      phaseName: parsed.data.phaseName,
      title: parsed.data.title,
      content: parsed.data.content,
      fleetImageUrl: parsed.data.fleetImageUrl || null,
      airbaseImageUrl: parsed.data.airbaseImageUrl || null,
      routineCardIds: parsed.data.routineCardIds || null,
      isPinned: parsed.data.isPinned ?? false,
      updatedById: user.id,
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "strategy.create",
    entityType: "StrategyPost",
    entityId: post.id,
    activityId: post.activityId,
    after: post,
  });

  return NextResponse.json({ post });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = strategyPostSchema.safeParse(await request.json());

  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "缺少攻略贴 ID" }, { status: 400 });
  }

  const existing = await prisma.strategyPost.findUnique({
    where: { id: parsed.data.id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "攻略贴不存在" }, { status: 404 });
  if (!canEditOwnedResource(user, existing.userId)) return NextResponse.json({ error: "只能编辑自己的攻略贴，或由规划者/管理员编辑" }, { status: 403 });
  if (!isActivityWritable(existing.activity)) {
    return NextResponse.json({ error: "活动已归档，攻略档案只读" }, { status: 403 });
  }

  const targetActivityId = normalizeActivityId(parsed.data.activityId);
  if (targetActivityId !== existing.activityId) {
    const targetActivity = targetActivityId
      ? await prisma.activity.findUnique({ where: { id: targetActivityId }, select: { status: true, isActive: true } })
      : null;
    if (targetActivityId && !targetActivity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    if (!isActivityWritable(targetActivity)) {
      return NextResponse.json({ error: "目标活动已归档，攻略档案只读" }, { status: 403 });
    }
  }

  const post = await prisma.strategyPost.update({
    where: { id: parsed.data.id },
    data: {
      phaseName: parsed.data.phaseName,
      activityId: targetActivityId,
      title: parsed.data.title,
      content: parsed.data.content,
      fleetImageUrl: parsed.data.fleetImageUrl || null,
      airbaseImageUrl: parsed.data.airbaseImageUrl || null,
      routineCardIds: parsed.data.routineCardIds || null,
      updatedById: user.id,
      ...(parsed.data.isPinned !== undefined ? { isPinned: parsed.data.isPinned } : {}),
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "strategy.update",
    entityType: "StrategyPost",
    entityId: post.id,
    activityId: post.activityId,
    before: existing,
    after: post,
  });

  return NextResponse.json({ post });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "缺少攻略贴 ID" }, { status: 400 });

  const existing = await prisma.strategyPost.findUnique({
    where: { id },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!existing || existing.isDeleted) return NextResponse.json({ error: "攻略贴不存在" }, { status: 404 });
  if (!canEditOwnedResource(user, existing.userId)) return NextResponse.json({ error: "只能删除自己的攻略贴，或由规划者/管理员删除" }, { status: 403 });
  if (!isActivityWritable(existing.activity)) {
    return NextResponse.json({ error: "活动已归档，攻略档案只读" }, { status: 403 });
  }

  const post = await prisma.strategyPost.update({
    where: { id },
    data: { isDeleted: true, updatedById: user.id },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "strategy.delete",
    entityType: "StrategyPost",
    entityId: post.id,
    activityId: post.activityId,
    before: existing,
    after: post,
  });

  return NextResponse.json({ ok: true });
}

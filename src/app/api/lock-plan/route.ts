import { NextResponse } from "next/server";
import { Prisma, type LockPlan } from "@prisma/client";

import { normalizeActivityId } from "@/lib/activity-scope";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditOwnedResource, isActivityWritable, isLockPlanVersionConflict } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { assertLockAssignmentsString, lockPlanBatchSchema, lockPlanSchema } from "@/lib/validators";

function serializePlan(plan: LockPlan) {
  return {
    id: plan.id,
    userId: plan.userId,
    tagId: plan.tagId,
    assignedData: plan.assignedData,
    note: plan.note,
    sortOrder: plan.sortOrder,
    version: plan.version,
    updatedById: plan.updatedById,
    updatedAt: plan.updatedAt.toISOString(),
    createdAt: plan.createdAt.toISOString(),
  };
}

function isVersionConflict(plan: LockPlan, knownVersion?: number) {
  return isLockPlanVersionConflict(plan.version, knownVersion);
}

function planConflictResponse(plan: LockPlan, message = "该锁船规划刚被其他人修改，请刷新页面后再编辑") {
  return NextResponse.json(
    { error: message, latestPlan: serializePlan(plan) },
    { status: 409 },
  );
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));
  const plans = await prisma.lockPlan.findMany({
    where: { userId: user.id, tag: { activityId } },
    include: { tag: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ plans: plans.map(serializePlan) });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockPlanSchema.safeParse(await request.json());

  if (!parsed.success || !assertLockAssignmentsString(parsed.data.assignedData)) {
    return NextResponse.json({ error: "锁船规划字段不完整，或 assignedData 不是合法舰船分配数组" }, { status: 400 });
  }

  const targetUserId = parsed.data.userId ?? user.id;
  if (!canEditOwnedResource(user, targetUserId)) {
    return NextResponse.json({ error: "只能编辑自己的锁船计划，或由规划者/管理员编辑全员计划" }, { status: 403 });
  }

  const tag = await prisma.lockTag.findUnique({
    where: { id: parsed.data.tagId },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (!tag) return NextResponse.json({ error: "锁船标签不存在" }, { status: 404 });
  if (!isActivityWritable(tag.activity)) {
    return NextResponse.json({ error: "活动已归档，锁船计划只读" }, { status: 403 });
  }

  try {
    const plan = await prisma.lockPlan.create({
      data: {
        userId: targetUserId,
        tagId: parsed.data.tagId,
        assignedData: parsed.data.assignedData,
        note: parsed.data.note || null,
        updatedById: user.id,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "lock_plan.create",
      entityType: "LockPlan",
      entityId: plan.id,
      activityId: tag.activityId,
      after: serializePlan(plan),
    });

    return NextResponse.json({ plan: serializePlan(plan) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.lockPlan.findUnique({
        where: { userId_tagId: { userId: targetUserId, tagId: parsed.data.tagId } },
      });
      if (existing) return planConflictResponse(existing);
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockPlanSchema.safeParse(await request.json());

  if (!parsed.success || !parsed.data.id || !assertLockAssignmentsString(parsed.data.assignedData)) {
    return NextResponse.json({ error: "缺少规划 ID 或字段不合法" }, { status: 400 });
  }

  const targetUserId = parsed.data.userId ?? user.id;
  const existing = await prisma.lockPlan.findUnique({
    where: { id: parsed.data.id },
    include: { tag: { include: { activity: { select: { status: true, isActive: true } } } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "锁船规划不存在，请刷新页面后再试" }, { status: 404 });
  }
  if (!canEditOwnedResource(user, existing.userId)) {
    return NextResponse.json({ error: "只能编辑自己的锁船计划，或由规划者/管理员编辑全员计划" }, { status: 403 });
  }
  if (existing.userId !== targetUserId) {
    return planConflictResponse(existing, "该锁船规划归属已变化，请刷新页面后再编辑");
  }
  if (!isActivityWritable(existing.tag.activity)) {
    return NextResponse.json({ error: "活动已归档，锁船计划只读" }, { status: 403 });
  }
  if (isVersionConflict(existing, parsed.data.version)) {
    return planConflictResponse(existing);
  }

  const plan = await prisma.lockPlan.update({
    where: { id: parsed.data.id },
    data: {
      tagId: parsed.data.tagId,
      assignedData: parsed.data.assignedData,
      note: parsed.data.note || null,
      updatedById: user.id,
      version: { increment: 1 },
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "lock_plan.update",
    entityType: "LockPlan",
    entityId: plan.id,
    activityId: existing.tag.activityId,
    before: serializePlan(existing),
    after: serializePlan(plan),
  });

  return NextResponse.json({ plan: serializePlan(plan) });
}

export async function PUT(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockPlanBatchSchema.safeParse(await request.json());

  if (
    !parsed.success ||
    !parsed.data.plans.every((plan) => assertLockAssignmentsString(plan.assignedData))
  ) {
    return NextResponse.json({ error: "锁船规划字段不完整，或 assignedData 不是合法舰船分配数组" }, { status: 400 });
  }

  const normalizedPlans = parsed.data.plans.map((plan) => ({
    ...plan,
    userId: plan.userId ?? user.id,
  }));

  const unauthorizedPlan = normalizedPlans.find((plan) => !canEditOwnedResource(user, plan.userId));
  if (unauthorizedPlan) {
    return NextResponse.json({ error: "只能编辑自己的锁船计划，或由规划者/管理员编辑全员计划" }, { status: 403 });
  }

  const tagIds = [...new Set(normalizedPlans.map((plan) => plan.tagId))];
  const tags = await prisma.lockTag.findMany({
    where: { id: { in: tagIds } },
    include: { activity: { select: { status: true, isActive: true } } },
  });
  if (tags.length !== tagIds.length) {
    return NextResponse.json({ error: "锁船标签不存在" }, { status: 404 });
  }
  if (tags.some((tag) => !isActivityWritable(tag.activity))) {
    return NextResponse.json({ error: "活动已归档，锁船计划只读" }, { status: 403 });
  }
  const activityIdByTagId = new Map(tags.map((tag) => [tag.id, tag.activityId]));

  const existingPlans = await Promise.all(
    normalizedPlans.map((plan) =>
      plan.id
        ? prisma.lockPlan.findUnique({ where: { id: plan.id } })
        : prisma.lockPlan.findUnique({ where: { userId_tagId: { userId: plan.userId, tagId: plan.tagId } } }),
    ),
  );

  for (let index = 0; index < normalizedPlans.length; index += 1) {
    const incoming = normalizedPlans[index];
    const existing = existingPlans[index];
    if (!existing && incoming.id) {
      return NextResponse.json({ error: "锁船规划不存在，请刷新页面后再试" }, { status: 404 });
    }
    if (existing && (existing.userId !== incoming.userId || existing.tagId !== incoming.tagId)) {
      return planConflictResponse(existing, "该锁船规划归属已变化，请刷新页面后再编辑");
    }
    if (existing && isVersionConflict(existing, incoming.version)) {
      return planConflictResponse(existing);
    }
    if (existing && !incoming.id && incoming.version === undefined) {
      return planConflictResponse(existing);
    }
  }

  const savedPlans = await prisma.$transaction(
    normalizedPlans.map((plan, index) => {
      const existing = existingPlans[index];
      if (existing) {
        return prisma.lockPlan.update({
          where: { id: existing.id },
          data: {
            assignedData: plan.assignedData,
            note: plan.note || null,
            updatedById: user.id,
            version: { increment: 1 },
          },
        });
      }
      return prisma.lockPlan.create({
        data: {
          userId: plan.userId,
          tagId: plan.tagId,
          assignedData: plan.assignedData,
          note: plan.note || null,
          updatedById: user.id,
        },
      });
    }),
  );

  await Promise.all(savedPlans.map((plan, index) =>
    writeAuditLog({
      actorId: user.id,
      action: existingPlans[index] ? "lock_plan.update" : "lock_plan.create",
      entityType: "LockPlan",
      entityId: plan.id,
      activityId: activityIdByTagId.get(plan.tagId) ?? null,
      before: existingPlans[index] ? serializePlan(existingPlans[index]) : undefined,
      after: serializePlan(plan),
    }),
  ));

  return NextResponse.json({ plans: savedPlans.map(serializePlan) });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少规划 ID" }, { status: 400 });
  }

  const targetUserId = searchParams.get("userId") ?? user.id;
  const existing = await prisma.lockPlan.findUnique({
    where: { id },
    include: { tag: { include: { activity: { select: { status: true, isActive: true } } } } },
  });
  if (!existing) return NextResponse.json({ error: "锁船规划不存在" }, { status: 404 });
  if (existing.userId !== targetUserId || !canEditOwnedResource(user, existing.userId)) {
    return NextResponse.json({ error: "只能删除自己的锁船计划，或由规划者/管理员删除全员计划" }, { status: 403 });
  }
  if (!isActivityWritable(existing.tag.activity)) {
    return NextResponse.json({ error: "活动已归档，锁船计划只读" }, { status: 403 });
  }

  await prisma.lockPlan.delete({
    where: { id },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "lock_plan.delete",
    entityType: "LockPlan",
    entityId: existing.id,
    activityId: existing.tag.activityId,
    before: serializePlan(existing),
  });

  return NextResponse.json({ ok: true });
}

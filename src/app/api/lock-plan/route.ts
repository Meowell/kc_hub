import { NextResponse } from "next/server";
import { Prisma, type LockPlan } from "@prisma/client";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertLockAssignmentsString, lockPlanBatchSchema, lockPlanSchema } from "@/lib/validators";

function serializePlan(plan: LockPlan) {
  return {
    ...plan,
    updatedAt: plan.updatedAt.toISOString(),
    createdAt: plan.createdAt.toISOString(),
  };
}

function isVersionConflict(plan: LockPlan, knownUpdatedAt?: string) {
  return !!knownUpdatedAt && plan.updatedAt.toISOString() !== knownUpdatedAt;
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

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const plans = await prisma.lockPlan.findMany({
    where: { userId: user.id },
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

  try {
    const plan = await prisma.lockPlan.create({
      data: {
        userId: targetUserId,
        tagId: parsed.data.tagId,
        assignedData: parsed.data.assignedData,
        note: parsed.data.note || null,
      },
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
  const existing = await prisma.lockPlan.findUnique({ where: { id: parsed.data.id } });

  if (!existing) {
    return NextResponse.json({ error: "锁船规划不存在，请刷新页面后再试" }, { status: 404 });
  }
  if (existing.userId !== targetUserId) {
    return planConflictResponse(existing, "该锁船规划归属已变化，请刷新页面后再编辑");
  }
  if (isVersionConflict(existing, parsed.data.updatedAt)) {
    return planConflictResponse(existing);
  }

  const plan = await prisma.lockPlan.update({
    where: { id: parsed.data.id },
    data: {
      tagId: parsed.data.tagId,
      assignedData: parsed.data.assignedData,
      note: parsed.data.note || null,
    },
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
    if (existing && isVersionConflict(existing, incoming.updatedAt)) {
      return planConflictResponse(existing);
    }
    if (existing && !incoming.id && !incoming.updatedAt) {
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
          },
        });
      }
      return prisma.lockPlan.create({
        data: {
          userId: plan.userId,
          tagId: plan.tagId,
          assignedData: plan.assignedData,
          note: plan.note || null,
        },
      });
    }),
  );

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
  await prisma.lockPlan.delete({
    where: { id, userId: targetUserId },
  });

  return NextResponse.json({ ok: true });
}

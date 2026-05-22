import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertLockAssignmentsString, lockPlanSchema } from "@/lib/validators";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const plans = await prisma.lockPlan.findMany({
    where: { userId: user.id },
    include: { tag: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockPlanSchema.safeParse(await request.json());

  if (!parsed.success || !assertLockAssignmentsString(parsed.data.assignedData)) {
    return NextResponse.json({ error: "锁船规划字段不完整，或 assignedData 不是合法舰船分配数组" }, { status: 400 });
  }

  const plan = await prisma.lockPlan.create({
    data: {
      userId: user.id,
      tagId: parsed.data.tagId,
      assignedData: parsed.data.assignedData,
      note: parsed.data.note || null,
    },
  });

  return NextResponse.json({ plan });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockPlanSchema.safeParse(await request.json());

  if (!parsed.success || !parsed.data.id || !assertLockAssignmentsString(parsed.data.assignedData)) {
    return NextResponse.json({ error: "缺少规划 ID 或字段不合法" }, { status: 400 });
  }

  const plan = await prisma.lockPlan.update({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      tagId: parsed.data.tagId,
      assignedData: parsed.data.assignedData,
      note: parsed.data.note || null,
    },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少规划 ID" }, { status: 400 });
  }

  await prisma.lockPlan.delete({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}

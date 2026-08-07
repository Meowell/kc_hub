import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findRoutineCollection,
  findRoutineCollectionStep,
} from "@/lib/routine-collections";

const progressSchema = z.object({
  collectionKey: z.string().trim().min(1).max(80),
  stepKey: z.string().trim().min(1).max(80),
  completedCount: z.number().int().min(0),
});

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const collectionKey = new URL(request.url).searchParams.get("collectionKey")?.trim() ?? "";
  if (!findRoutineCollection(collectionKey)) {
    return NextResponse.json({ error: "作业合集不存在" }, { status: 404 });
  }

  const progress = await prisma.routineCollectionProgress.findMany({
    where: { userId: user.id, collectionKey },
    select: { stepKey: true, completedCount: true },
  });

  return NextResponse.json({ progress });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "进度字段不完整" }, { status: 400 });
  }

  const { collectionKey, stepKey, completedCount } = parsed.data;
  const step = findRoutineCollectionStep(collectionKey, stepKey);
  if (!step) {
    return NextResponse.json({ error: "作业步骤不存在" }, { status: 404 });
  }
  if (completedCount > step.requiredCount) {
    return NextResponse.json({ error: "完成次数超出该步骤要求" }, { status: 400 });
  }

  if (completedCount === 0) {
    await prisma.routineCollectionProgress.deleteMany({
      where: { userId: user.id, collectionKey, stepKey },
    });
  } else {
    await prisma.routineCollectionProgress.upsert({
      where: {
        userId_collectionKey_stepKey: { userId: user.id, collectionKey, stepKey },
      },
      update: { completedCount },
      create: { userId: user.id, collectionKey, stepKey, completedCount },
    });
  }

  return NextResponse.json({ progress: { stepKey, completedCount } });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const collectionKey = new URL(request.url).searchParams.get("collectionKey")?.trim() ?? "";
  if (!findRoutineCollection(collectionKey)) {
    return NextResponse.json({ error: "作业合集不存在" }, { status: 404 });
  }

  await prisma.routineCollectionProgress.deleteMany({
    where: { userId: user.id, collectionKey },
  });

  return NextResponse.json({ ok: true });
}

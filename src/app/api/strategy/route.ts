import { NextResponse } from "next/server";

import { normalizeActivityId } from "@/lib/activity-scope";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategyPostSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));

  const posts = await prisma.strategyPost.findMany({
    where: { activityId },
    orderBy: [{ phaseName: "asc" }, { createdAt: "desc" }],
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

  const post = await prisma.strategyPost.create({
    data: {
      userId: user.id,
      activityId: normalizeActivityId(parsed.data.activityId),
      phaseName: parsed.data.phaseName,
      title: parsed.data.title,
      content: parsed.data.content,
      fleetImageUrl: parsed.data.fleetImageUrl || null,
      airbaseImageUrl: parsed.data.airbaseImageUrl || null,
      routineCardIds: parsed.data.routineCardIds || null,
    },
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

  const existing = await prisma.strategyPost.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return NextResponse.json({ error: "攻略贴不存在" }, { status: 404 });
  if (existing.userId !== user.id) return NextResponse.json({ error: "只能编辑自己的攻略贴" }, { status: 403 });

  const post = await prisma.strategyPost.update({
    where: { id: parsed.data.id },
    data: {
      phaseName: parsed.data.phaseName,
      activityId: normalizeActivityId(parsed.data.activityId),
      title: parsed.data.title,
      content: parsed.data.content,
      fleetImageUrl: parsed.data.fleetImageUrl || null,
      airbaseImageUrl: parsed.data.airbaseImageUrl || null,
      routineCardIds: parsed.data.routineCardIds || null,
    },
  });

  return NextResponse.json({ post });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "缺少攻略贴 ID" }, { status: 400 });

  const existing = await prisma.strategyPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "攻略贴不存在" }, { status: 404 });
  if (existing.userId !== user.id) return NextResponse.json({ error: "只能删除自己的攻略贴" }, { status: 403 });

  await prisma.strategyPost.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

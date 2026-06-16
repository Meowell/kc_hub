import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activitySchema } from "@/lib/validators";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const activities = await prisma.activity.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = activitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "活动名称不能为空，且不能超过 80 个字符" }, { status: 400 });
  }

  const maxOrder = await prisma.activity.aggregate({ _max: { sortOrder: true } });
  const activity = await prisma.activity.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status ?? "active",
      sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ activity });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const parsed = activitySchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "缺少活动 ID 或字段不合法" }, { status: 400 });
  }

  const activity = await prisma.activity.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });

  return NextResponse.json({ activity });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少活动 ID" }, { status: 400 });

  await prisma.activity.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lockTagSchema } from "@/lib/validators";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const tags = await prisma.lockTag.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockTagSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "标签字段不完整：name 不能为空，colorClass 需为合法颜色" }, { status: 400 });
  }

  const { name, colorClass, sortOrder } = parsed.data;

  // Get max sortOrder for new tag
  const maxOrder = await prisma.lockTag.aggregate({ _max: { sortOrder: true } });
  const nextOrder = sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1;

  const tag = await prisma.lockTag.create({
    data: { name, colorClass, sortOrder: nextOrder },
  });

  return NextResponse.json({ tag });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = lockTagSchema.safeParse(await request.json());

  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ error: "缺少标签 ID 或字段不合法" }, { status: 400 });
  }

  const { id, name, colorClass, sortOrder } = parsed.data;

  const tag = await prisma.lockTag.update({
    where: { id },
    data: { name, colorClass, ...(sortOrder !== undefined ? { sortOrder } : {}) },
  });

  return NextResponse.json({ tag });
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少标签 ID" }, { status: 400 });
  }

  await prisma.lockTag.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { parseNoro6Data } from "@/lib/noro6";
import { prisma } from "@/lib/prisma";
import { shipDataSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const userId = request.nextUrl.searchParams.get("userId");

  if (userId) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipData: true },
    });
    if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    return NextResponse.json({ shipData: target.shipData ?? "" });
  }

  return NextResponse.json({ shipData: user.shipData ?? "" });
}

export async function PUT(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const parsed = shipDataSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "存档内容不能为空，且不能超过 8MB" }, { status: 400 });
  }

  try {
    parseNoro6Data(parsed.data.shipData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "noro6 存档格式错误" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { shipData: parsed.data.shipData },
    select: { shipData: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

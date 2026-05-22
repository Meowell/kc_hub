import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";

export async function POST() {
  try {
    const user = await getApiUser();
    if (!user) return unauthorizedApiResponse();

    // 检查粮食是否足够
    if (user.food < 1) {
      return NextResponse.json({ error: "🍙 战斗粮食不足！请先签到获取粮食" }, { status: 403 });
    }

    // 扣除 1 个粮食
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { food: { decrement: 1 } },
      select: { food: true },
    });

    return NextResponse.json({ food: updated.food });
  } catch (error) {
    console.error("[games/start]", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

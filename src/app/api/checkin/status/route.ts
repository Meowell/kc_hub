import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const today = getTodayDateString();

  const [checkIn, fullUser] = await Promise.all([
    prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { food: true },
    }),
  ]);

  return NextResponse.json({
    checkedIn: !!checkIn,
    todayReward: checkIn?.reward ?? null,
    totalFood: fullUser?.food ?? 0,
  });
}

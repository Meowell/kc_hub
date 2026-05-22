import { NextResponse } from "next/server";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function randomReward(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const today = getTodayDateString();

  // 检查今天是否已签到
  const existing = await prisma.dailyCheckIn.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "今天已经签到过了", reward: existing.reward },
      { status: 400 },
    );
  }

  // 判断周末
  const dayOfWeek = new Date().getDay(); // 0=周日, 6=周六
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 随机奖励
  const reward = isWeekend ? randomReward(5, 6) : randomReward(2, 3);

  // 原子操作：创建签到记录 + 增加粮食
  const [checkIn] = await prisma.$transaction([
    prisma.dailyCheckIn.create({
      data: { userId: user.id, date: today, reward },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { food: { increment: reward } },
    }),
  ]);

  // 查询更新后的粮食数量
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { food: true },
  });

  return NextResponse.json({
    reward,
    totalFood: updatedUser?.food ?? 0,
    isWeekend,
  });
}

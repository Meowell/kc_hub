import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  gameType: z.enum(["dino", "survivor", "invaders"]),
  score: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getApiUser();
    if (!user) return unauthorizedApiResponse();
    const body = await req.json();
    const { gameType, score } = bodySchema.parse(body);

    // 查询旧的最高分（判断是否刷新纪录）
    const prevBest = await prisma.gameScore.aggregate({
      where: { gameType },
      _max: { score: true },
    });
    const oldMax = prevBest._max.score || 0;

    // 保存分数
    await prisma.gameScore.create({
      data: {
        userId: user.id,
        gameType,
        score,
      },
    });

    // 新纪录 +10 粮食
    const newRecord = score > oldMax;
    let food = user.food;
    if (newRecord) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { food: { increment: 10 } },
        select: { food: true },
      });
      food = updated.food;
    }

    // 坚持 60 秒以上返还 1 个粮食（不和 newRecord 冲突）
    let refunded = false;
    if (score >= 60 && !newRecord) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { food: { increment: 1 } },
        select: { food: true },
      });
      food = updated.food;
      refunded = true;
    } else if (score >= 60 && newRecord) {
      // 新纪录已经 +10，60秒的 +1 也加上
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { food: { increment: 1 } },
        select: { food: true },
      });
      food = updated.food;
      refunded = true;
    }

    // 查询该游戏类型 Top 3 排行榜
    const top3 = await prisma.gameScore.findMany({
      where: { gameType },
      orderBy: { score: "desc" },
      take: 3,
      select: {
        score: true,
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({
      newRecord,
      refunded,
      food,
      top3: top3.map((r) => ({ name: r.user.name, score: r.score })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }
    console.error("[games/end]", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const validTypes = ["dino", "survivor", "invaders"] as const;

export async function GET(req: NextRequest) {
  try {
    const gameType = req.nextUrl.searchParams.get("type");

    if (!gameType || !validTypes.includes(gameType as typeof validTypes[number])) {
      return NextResponse.json({ error: "无效的游戏类型" }, { status: 400 });
    }

    const top3 = await prisma.gameScore.findMany({
      where: { gameType: gameType as string },
      orderBy: { score: "desc" },
      take: 3,
      select: {
        score: true,
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({
      top3: top3.map((r) => ({ name: r.user.name, score: r.score })),
    });
  } catch (error) {
    console.error("[games/leaderboard]", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

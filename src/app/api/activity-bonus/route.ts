import { NextResponse } from "next/server";

import { normalizeActivityId } from "@/lib/activity-scope";
import { normalizeActivityBonusConfig } from "@/lib/activity-bonus";
import { readActivityBonusRaw, writeActivityBonusConfig } from "@/lib/activity-bonus-storage";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { canManageSharedResource, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

function activityBonusRequiresActivityResponse() {
  return NextResponse.json({ error: "倍卡配置需要选择活动" }, { status: 400 });
}

function parseIncomingConfig(body: Record<string, unknown>) {
  if (typeof body.bonusData === "string") {
    const text = body.bonusData.trim();
    if (!text) return normalizeActivityBonusConfig({});

    try {
      return normalizeActivityBonusConfig(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("倍卡配置不是合法 JSON");
      }
      throw error;
    }
  }

  return normalizeActivityBonusConfig(body.config ?? {});
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));
  if (!activityId) return activityBonusRequiresActivityResponse();

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true },
  });
  if (!activity) return NextResponse.json({ error: "活动不存在" }, { status: 404 });

  return NextResponse.json({ bonusData: await readActivityBonusRaw(activity.id) });
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  if (!canManageSharedResource(user)) {
    return NextResponse.json({ error: "只有规划者或管理员可以管理倍卡配置" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体必须是 JSON 对象" }, { status: 400 });
  }

  const activityId = normalizeActivityId((body as Record<string, unknown>).activityId as string | null | undefined);
  if (!activityId) return activityBonusRequiresActivityResponse();

  const existing = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, status: true, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (!isActivityWritable(existing)) {
    return NextResponse.json({ error: "活动已归档，倍卡配置只读" }, { status: 403 });
  }

  let incomingConfig: ReturnType<typeof normalizeActivityBonusConfig>;
  try {
    incomingConfig = parseIncomingConfig(body as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "倍卡配置格式错误" },
      { status: 400 },
    );
  }

  const bonusData = await writeActivityBonusConfig(activityId, incomingConfig);

  return NextResponse.json({ bonusData });
}

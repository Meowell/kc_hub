import { NextResponse } from "next/server";

import { normalizeActivityId } from "@/lib/activity-scope";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();
  const { searchParams } = new URL(request.url);
  const activityId = normalizeActivityId(searchParams.get("activityId"));

  const [tags, users, allPlans] = await Promise.all([
    prisma.lockTag.findMany({
      where: { activityId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, shipData: true },
      orderBy: { name: "asc" },
    }),
    prisma.lockPlan.findMany({
      where: { tag: { activityId } },
      select: { id: true, userId: true, tagId: true, assignedData: true, note: true, updatedAt: true, version: true },
    }),
  ]);

  // Build per-user plan map
  const plansByUser = new Map<string, typeof allPlans>();
  for (const plan of allPlans) {
    const list = plansByUser.get(plan.userId);
    if (list) {
      list.push(plan);
    } else {
      plansByUser.set(plan.userId, [plan]);
    }
  }

  const globalData = {
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      colorClass: t.colorClass,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    })),
    users: users.map((u) => ({
      userId: u.id,
      userName: u.name,
      hasShipData: !!(u.shipData && u.shipData.trim()),
      plans: (plansByUser.get(u.id) ?? []).map((p) => ({
        planId: p.id,
        tagId: p.tagId,
        assignedData: p.assignedData,
        note: p.note,
        updatedAt: p.updatedAt.toISOString(),
        version: p.version,
      })),
    })),
  };

  return NextResponse.json(globalData);
}

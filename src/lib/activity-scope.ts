import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { DAILY_ACTIVITY_ID, type ActivityOption } from "@/lib/activity-types";

export { DAILY_ACTIVITY_ID, type ActivityOption };

export type ActivityScope = {
  activityId: string | null;
  scopeKey: string;
  label: string;
  isDaily: boolean;
};

export function normalizeActivityId(value?: string | null) {
  if (!value || value === DAILY_ACTIVITY_ID) return null;
  return value;
}

export function activityQuery(activityId: string | null) {
  return activityId ? `activityId=${encodeURIComponent(activityId)}` : "";
}

export function scopedPath(pathname: string, activityId: string | null) {
  const query = activityQuery(activityId);
  return query ? `${pathname}?${query}` : pathname;
}

export function activityWhere(activityId: string | null) {
  return { activityId };
}

export async function getActiveActivities(): Promise<ActivityOption[]> {
  const activities = await prisma.activity.findMany({
    where: { isActive: true, status: { not: "hidden" } },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return activities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    description: activity.description,
    isActive: activity.isActive,
  }));
}

export async function resolveActivityScope(activityIdParam?: string | null): Promise<ActivityScope> {
  const activityId = normalizeActivityId(activityIdParam);
  if (!activityId) {
    return {
      activityId: null,
      scopeKey: DAILY_ACTIVITY_ID,
      label: "日常",
      isDaily: true,
    };
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, isActive: true, status: { not: "hidden" } },
    select: { id: true, name: true },
  });

  if (!activity) notFound();

  return {
    activityId: activity.id,
    scopeKey: activity.id,
    label: activity.name,
    isDaily: false,
  };
}

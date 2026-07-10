import { ShipDataCenter } from "@/components/ship-data/ship-data-center";
import { UpdateMastersButton } from "@/components/ship-data/update-masters-button";
import { readActivityOverview } from "@/lib/activity-overview-storage";
import { requireCurrentUser } from "@/lib/auth";
import { parseAssignments } from "@/lib/lock-plan-helpers";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const activity = await prisma.activity.findFirst({
    where: { isActive: true, status: { not: "hidden" } },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
  const [lockTags, lockPlans, activityOverview] = await Promise.all([
    activity
      ? prisma.lockTag.findMany({
          where: { activityId: activity.id, isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, colorClass: true, sortOrder: true },
        })
      : [],
    activity
      ? prisma.lockPlan.findMany({
          where: { userId: user.id, tag: { activityId: activity.id, isActive: true } },
          select: { tagId: true, assignedData: true },
        })
      : [],
    readActivityOverview(activity?.id, activity?.name ?? "暂无活动"),
  ]);
  const lockAssignmentsByTagId = Object.fromEntries(
    lockPlans.map((plan) => [
      plan.tagId,
      parseAssignments(plan.assignedData).flatMap((assignment) => assignment ? [assignment.uniqueId] : []),
    ]),
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="terminal-label text-xs font-semibold text-primary">DATA / FLEET REGISTRY</p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">舰籍数据</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            上传 noro6 舰船存档，解锁大部分功能。
          </p>
        </div>
        <UpdateMastersButton />
      </div>

      <ShipDataCenter
        initialShipData={user.shipData ?? ""}
        initialLastShipDataUpdatedAt={user.lastShipDataUpdatedAt?.toISOString() ?? null}
        currentUserName={user.name}
        currentActivityName={activity?.name ?? "暂无活动"}
        lockTags={lockTags}
        lockAssignmentsByTagId={lockAssignmentsByTagId}
        activityOverview={activityOverview}
      />
    </div>
  );
}

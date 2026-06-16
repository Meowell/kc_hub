import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { LockPlanGodView } from "@/components/lock-plan/lock-plan-god-view";
import { getActiveActivities, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

export default async function LockPlanGlobalPage({
  searchParams,
}: {
  searchParams: { activityId?: string };
}) {
  const currentUser = await requireCurrentUser();
  const [activities, scope] = await Promise.all([
    getActiveActivities(),
    resolveActivityScope(searchParams.activityId),
  ]);

  const [tags, users, allPlans] = await Promise.all([
    prisma.lockTag.findMany({
      where: { activityId: scope.activityId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, avatarUrl: true, shipData: true },
      orderBy: { name: "asc" },
    }),
    prisma.lockPlan.findMany({
      where: { tag: { activityId: scope.activityId } },
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

  // Build user list: only show users who have at least one lock plan record,
  // but always include the current user so they can start planning.
  const mappedUsers = users
    .filter((u) => u.id === currentUser.id || plansByUser.has(u.id))
    .map((u) => ({
      userId: u.id,
      userName: u.name,
      avatarUrl: u.avatarUrl,
      hasShipData: !!(u.shipData && u.shipData.trim()),
      shipDataRaw: u.shipData ?? "",
      plans: (plansByUser.get(u.id) ?? []).map((p) => ({
        planId: p.id,
        tagId: p.tagId,
        assignedData: p.assignedData,
        note: p.note,
        updatedAt: p.updatedAt.toISOString(),
        version: p.version,
      })),
    }));

  // Sort: current user first, then alphabetically by name
  mappedUsers.sort((a, b) => {
    if (a.userId === currentUser.id) return -1;
    if (b.userId === currentUser.id) return 1;
    return a.userName.localeCompare(b.userName, "zh");
  });

  return (
    <div className="space-y-6">
      <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} />
      <LockPlanGodView
        initialTags={tags.map((t) => ({
          id: t.id,
          name: t.name,
          colorClass: t.colorClass,
          sortOrder: t.sortOrder,
          isActive: t.isActive,
        }))}
        initialUsers={mappedUsers}
        currentUserId={currentUser.id}
        activityId={scope.activityId}
        activityLabel={scope.label}
        isDailyScope={scope.isDaily}
        canManageTags={canManageSharedResource(currentUser)}
        canEditAllPlans={canManageSharedResource(currentUser)}
      />
    </div>
  );
}

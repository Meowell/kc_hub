import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { StrategyEditor } from "@/components/strategy/strategy-editor";
import { getActiveActivities, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: { activityId?: string };
}) {
  const user = await requireCurrentUser();
  const [activities, scope] = await Promise.all([
    getActiveActivities(),
    resolveActivityScope(searchParams.activityId),
  ]);

  const [posts, routineRecords] = await Promise.all([
    prisma.strategyPost.findMany({
      where: { activityId: scope.activityId },
      orderBy: [{ phaseName: "asc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.routineRecord.findMany({
      where: { activityId: scope.activityId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const serializablePosts = posts.map((post) => ({
    id: post.id,
    phaseName: post.phaseName,
    title: post.title,
    content: post.content,
    fleetImageUrl: post.fleetImageUrl,
    airbaseImageUrl: post.airbaseImageUrl,
    routineCardIds: post.routineCardIds,
    user: { id: post.user.id, name: post.user.name, avatarUrl: post.user.avatarUrl },
    createdAt: post.createdAt.toISOString(),
  }));

  const serializableCards = routineRecords.map((r) => ({
    id: r.id,
    seaArea: r.seaArea,
    missionName: r.missionName,
    airControl: r.airControl,
    note: r.note,
    imageUrl: r.imageUrl,
    fleetData: r.fleetData,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, name: r.user.name },
  }));

  return (
    <div className="space-y-6">
      <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} />
      <div>
        <h1 className="text-2xl font-bold text-white">📝 {scope.label}攻略贴</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {scope.isDaily ? "日常打法、路线、配装思路与截图。" : "本期活动独立攻略、路线、配装思路与截图。"}
        </p>
      </div>
      <StrategyEditor
        posts={serializablePosts}
        currentUserId={user.id}
        routineCards={serializableCards}
        activityId={scope.activityId}
      />
    </div>
  );
}

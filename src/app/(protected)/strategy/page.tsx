import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { StrategyEditor } from "@/components/strategy/strategy-editor";
import { StrategyWorkspace } from "@/components/strategy/strategy-workspace";
import type { StrategyPostView } from "@/components/strategy/strategy-types";
import { getActiveActivities, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource, getVisibleContentWhere, isActivityWritable } from "@/lib/collaboration";
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

  const canManage = canManageSharedResource(user);

  if (!scope.isDaily && scope.activityId) {
    const [activityState, maps, lockTags, legacyPosts] = await Promise.all([
      prisma.activity.findUnique({ where: { id: scope.activityId }, select: { status: true, isActive: true } }),
      prisma.strategyMap.findMany({
        where: { activityId: scope.activityId },
        orderBy: [{ isDeleted: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          sections: {
            orderBy: [{ isDeleted: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              _count: { select: { posts: { where: { isDeleted: false } } } },
              lockTags: { orderBy: { sortOrder: "asc" }, include: { lockTag: true } },
              posts: {
                where: {
                  isDeleted: false,
                  OR: [{ status: "published" }, { userId: user.id }],
                },
                orderBy: { updatedAt: "desc" },
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
              },
            },
          },
        },
      }),
      prisma.lockTag.findMany({
        where: { activityId: scope.activityId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.strategyPost.findMany({
        where: {
          activityId: scope.activityId,
          sectionId: null,
          isDeleted: false,
          OR: [{ status: "published" }, { userId: user.id }],
        },
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    ]);

    const serializePost = (post: typeof legacyPosts[number]): StrategyPostView => ({
      id: post.id,
      userId: post.userId,
      activityId: post.activityId,
      sectionId: post.sectionId,
      phaseName: post.phaseName,
      title: post.title,
      content: post.content,
      contentFormat: post.contentFormat,
      status: post.status,
      revision: post.revision,
      plainText: post.plainText,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      isDeleted: post.isDeleted,
      isPinned: post.isPinned,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      user: post.user,
    });

    const serializableMaps = maps.map((map) => ({
      id: map.id,
      activityId: map.activityId,
      code: map.code,
      sortOrder: map.sortOrder,
      isOpenForPosts: map.isOpenForPosts,
      isDeleted: map.isDeleted,
      sections: map.sections.map((section) => ({
        id: section.id,
        strategyMapId: section.strategyMapId,
        name: section.name,
        sortOrder: section.sortOrder,
        isDeleted: section.isDeleted,
        postCount: section._count.posts,
        lockTags: section.lockTags,
        posts: section.posts.map((post) => serializePost(post)),
      })),
    }));

    return (
      <div className="space-y-5">
        <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} canCreateActivity={canManage} />
        <div>
          <p className="terminal-label text-xs font-semibold text-primary">TACTICAL NOTES / 攻略档案</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{scope.label}攻略档案</h1>
          <p className="mt-1.5 text-sm text-slate-400">按公共海图分块编写和查阅各成员的个人攻略。</p>
        </div>
        <StrategyWorkspace
          activityId={scope.activityId}
          maps={serializableMaps}
          lockTags={lockTags}
          legacyPosts={legacyPosts.map((post) => serializePost(post))}
          currentUserId={user.id}
          canManage={canManage}
          activityWritable={isActivityWritable(activityState)}
        />
      </div>
    );
  }

  const [posts, routineRecords] = await Promise.all([
    prisma.strategyPost.findMany({
      where: getVisibleContentWhere({ activityId: scope.activityId }),
      orderBy: [{ isPinned: "desc" }, { phaseName: "asc" }, { createdAt: "desc" }],
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.routineRecord.findMany({
      where: getVisibleContentWhere({ activityId: scope.activityId }),
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
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
      <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} canCreateActivity={canManage} />
      <div>
        <p className="terminal-label text-xs font-semibold text-primary">TACTICAL NOTES / 攻略档案</p>
        <h1 className="mt-2 text-2xl font-bold text-white">{scope.label}攻略档案</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {scope.isDaily ? "日常打法、路线、配装思路与截图。" : "本期活动独立攻略、路线、配装思路与截图。"}
        </p>
      </div>
      <StrategyEditor
        key={scope.scopeKey}
        posts={serializablePosts}
        currentUserId={user.id}
        routineCards={serializableCards}
        activityId={scope.activityId}
      />
    </div>
  );
}

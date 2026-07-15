import { redirect } from "next/navigation";

import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { StrategyWorkspace } from "@/components/strategy/strategy-workspace";
import type { StrategyPostView } from "@/components/strategy/strategy-types";
import { getActiveActivities, normalizeActivityId, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource, isActivityWritable } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: { activityId?: string };
}) {
  const user = await requireCurrentUser();
  const activities = await getActiveActivities();
  const canManage = canManageSharedResource(user);

  if (!normalizeActivityId(searchParams.activityId)) {
    const firstActivity = activities[0];
    if (firstActivity) {
      redirect(`/strategy?activityId=${encodeURIComponent(firstActivity.id)}`);
    }

    return (
      <div className="space-y-5">
        <ActivitySwitcher
          activities={activities}
          currentActivityId={null}
          showDaily={false}
          canCreateActivity={canManage}
        />
        <section className="surface-panel rounded-md p-5 sm:p-6">
          <p className="terminal-label text-xs font-semibold text-primary">TACTICAL NOTES / 攻略档案</p>
          <h1 className="mt-2 text-2xl font-bold text-white">活动攻略档案</h1>
          <p className="mt-2 text-sm text-slate-400">
            攻略只属于活动作战。请先建立活动档案，再配置海图与攻略分块。
          </p>
        </section>
      </div>
    );
  }

  const scope = await resolveActivityScope(searchParams.activityId);
  const activityId = scope.activityId;
  if (!activityId) redirect("/strategy");

  const [activityState, maps, lockTags, legacyPosts] = await Promise.all([
    prisma.activity.findUnique({ where: { id: activityId }, select: { status: true, isActive: true } }),
    prisma.strategyMap.findMany({
      where: { activityId },
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
      where: { activityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.strategyPost.findMany({
      where: {
        activityId,
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
      <ActivitySwitcher
        activities={activities}
        currentActivityId={activityId}
        showDaily={false}
        canCreateActivity={canManage}
      />
      <div>
        <p className="terminal-label text-xs font-semibold text-primary">TACTICAL NOTES / 攻略档案</p>
        <h1 className="mt-2 text-2xl font-bold text-white">{scope.label}攻略档案</h1>
        <p className="mt-1.5 text-sm text-slate-400">按公共海图分块编写和查阅各成员的个人攻略。</p>
      </div>
      <StrategyWorkspace
        activityId={activityId}
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

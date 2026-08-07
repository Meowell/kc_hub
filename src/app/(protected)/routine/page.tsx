import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { RoutineCollectionBoard } from "@/components/routine/routine-collection-board";
import { RoutineRecords } from "@/components/routine/routine-form";
import { RoutineFilter } from "@/components/routine/routine-filter";
import { getActiveActivities, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource, getVisibleContentWhere } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSafePage } from "@/lib/frontend-ux";
import { SEASONAL_MONTH_COLLECTION } from "@/lib/routine-collections";
import { ClipboardCheck, LayoutList } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 10;

function RoutineViewTabs({ collectionView }: { collectionView: boolean }) {
  return (
    <nav className="inline-flex w-full rounded-md border border-slate-700 bg-slate-900/60 p-1 sm:w-auto" aria-label="作业页面视图">
      <Link
        href="/routine"
        aria-current={!collectionView ? "page" : undefined}
        className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${
          !collectionView ? "bg-sky-500/18 text-sky-100" : "text-slate-400 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <LayoutList className="h-4 w-4" aria-hidden="true" />
        作业卡
      </Link>
      <Link
        href="/routine?view=collections"
        aria-current={collectionView ? "page" : undefined}
        className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${
          collectionView ? "bg-emerald-500/18 text-emerald-100" : "text-slate-400 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        作业合集
      </Link>
    </nav>
  );
}

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; seaArea?: string; uploaderId?: string; activityId?: string; view?: string };
}) {
  const user = await requireCurrentUser();
  const [activities, scope] = await Promise.all([
    getActiveActivities(),
    resolveActivityScope(searchParams.activityId),
  ]);
  const collectionView = scope.isDaily && searchParams.view === "collections";

  if (collectionView) {
    const collectionProgress = await prisma.routineCollectionProgress.findMany({
      where: { userId: user.id, collectionKey: SEASONAL_MONTH_COLLECTION.key },
      select: { stepKey: true, completedCount: true },
    });

    return (
      <div className="space-y-6">
        <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} canCreateActivity={canManageSharedResource(user)} />
        <RoutineViewTabs collectionView />
        <div>
          <p className="terminal-label text-xs font-semibold text-primary">ROUTINE COLLECTION / 作业合集</p>
          <h1 className="mt-2 text-2xl font-bold text-white">日常作业合集</h1>
          <p className="mt-1.5 text-sm text-slate-400">有序任务、所需次数与个人完成进度</p>
        </div>
        <RoutineCollectionBoard collection={SEASONAL_MONTH_COLLECTION} initialProgress={collectionProgress} />
      </div>
    );
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const search = searchParams.search?.trim() || undefined;
  const seaArea = searchParams.seaArea || undefined;
  const uploaderId = searchParams.uploaderId || undefined;

  // Build dynamic where clause
  const conditions: Prisma.RoutineRecordWhereInput[] = [getVisibleContentWhere({ activityId: scope.activityId })];
  if (search) {
    conditions.push({
      OR: [
        { seaArea: { contains: search } },
        { missionName: { contains: search } },
        { note: { contains: search } },
      ],
    });
  }
  if (seaArea) conditions.push({ seaArea });
  if (uploaderId) conditions.push({ userId: uploaderId });

  const where: Prisma.RoutineRecordWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  // Count first so an out-of-range page never queries an empty offset.
  const [totalCount, seaAreaGroups, uploaderGroups] = await Promise.all([
    prisma.routineRecord.count({ where }),
    prisma.routineRecord.groupBy({ by: ["seaArea"], where: getVisibleContentWhere({ activityId: scope.activityId }), orderBy: { seaArea: "asc" } }),
    prisma.routineRecord.groupBy({ by: ["userId"], where: getVisibleContentWhere({ activityId: scope.activityId }), orderBy: { userId: "asc" } }),
  ]);

  const { currentPage: safePage, totalPages } = getSafePage(currentPage, totalCount, PAGE_SIZE);
  const records = await prisma.routineRecord.findMany({
    where,
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // Resolve uploader names
  const userIds = uploaderGroups.map((g) => g.userId);
  const uploaders = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const serializableRecords = records.map((r) => ({
    id: r.id,
    seaArea: r.seaArea,
    missionName: r.missionName,
    airControl: r.airControl,
    note: r.note,
    imageUrl: r.imageUrl,
    fleetData: r.fleetData,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
  }));

  const seaAreas = seaAreaGroups.map((g) => g.seaArea);

  return (
    <div className="space-y-6">
      <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} canCreateActivity={canManageSharedResource(user)} />
      {scope.isDaily && <RoutineViewTabs collectionView={false} />}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="terminal-label text-xs font-semibold text-primary">SORTIE BOARD / 作业卡</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{scope.label}作业卡</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {scope.isDaily ? "日常周回阵容与配置存档" : "本期活动独立作业卡与配置存档"}
          </p>
        </div>
        <RoutineFilter
          seaAreas={seaAreas}
          uploaders={uploaders}
          currentSearch={search ?? ""}
          currentSeaArea={seaArea ?? ""}
          currentUploaderId={uploaderId ?? ""}
          currentActivityId={scope.activityId}
        />
      </div>
      <RoutineRecords
        key={scope.scopeKey}
        records={serializableRecords}
        currentPage={safePage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        search={search ?? ""}
        seaArea={seaArea ?? ""}
        uploaderId={uploaderId ?? ""}
        activityId={scope.activityId}
        shipData={user.shipData}
        currentUserId={user.id}
      />
    </div>
  );
}

import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { RoutineRecords } from "@/components/routine/routine-form";
import { RoutineFilter } from "@/components/routine/routine-filter";
import { getActiveActivities, resolveActivityScope } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource, getVisibleContentWhere } from "@/lib/collaboration";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSafePage } from "@/lib/frontend-ux";

const PAGE_SIZE = 10;

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; seaArea?: string; uploaderId?: string; activityId?: string };
}) {
  const user = await requireCurrentUser();
  const [activities, scope] = await Promise.all([
    getActiveActivities(),
    resolveActivityScope(searchParams.activityId),
  ]);

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

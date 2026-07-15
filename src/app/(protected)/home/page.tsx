import { AlertTriangle, ArrowRight, ClipboardList, Database, FileText, LockKeyhole, RadioTower } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { ActivitySwitcher } from "@/components/common/activity-switcher";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { getActiveActivities, resolveActivityScope, scopedPath } from "@/lib/activity-scope";
import { requireCurrentUser } from "@/lib/auth";
import { canManageSharedResource } from "@/lib/collaboration";
import { getRoleLabel } from "@/lib/collaboration";
import { buildLockMatrixSummary } from "@/lib/lock-plan-helpers";
import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "NO SIGNAL";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { activityId?: string };
}) {
  const user = await requireCurrentUser();
  const [activities, scope] = await Promise.all([
    getActiveActivities(),
    resolveActivityScope(searchParams.activityId),
  ]);

  const [members, tags, lockPlans, recentRoutine, recentStrategy] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        shipData: true,
        lastShipDataUpdatedAt: true,
      },
      orderBy: { name: "asc" },
    }),
    scope.isDaily
      ? Promise.resolve([])
      : prisma.lockTag.findMany({
        where: { activityId: scope.activityId, isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
    scope.isDaily
      ? Promise.resolve([])
      : prisma.lockPlan.findMany({
        where: { tag: { activityId: scope.activityId, isActive: true } },
        select: {
          id: true,
          userId: true,
          tagId: true,
          assignedData: true,
          updatedAt: true,
          user: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    prisma.routineRecord.findMany({
      where: { activityId: scope.activityId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    scope.isDaily
      ? Promise.resolve([])
      : prisma.strategyPost.findMany({
        where: { activityId: scope.activityId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
  ]);

  const syncedMembers = members.filter((member) => member.shipData?.trim());
  const missingMembers = members.filter((member) => !member.shipData?.trim());
  const lockSummary = buildLockMatrixSummary(
    tags.map((tag) => ({ id: tag.id, isActive: true })),
    members.map((member) => ({
      userId: member.id,
      hasShipData: !!member.shipData?.trim(),
      plans: lockPlans
        .filter((plan) => plan.userId === member.id)
        .map((plan) => ({ tagId: plan.tagId, assignedData: plan.assignedData })),
    })),
  );
  const latestLockUpdate = lockPlans[0]?.updatedAt;
  const latestLockUser = lockPlans[0]?.user.name;

  return (
    <div className="space-y-6">
      <ActivitySwitcher activities={activities} currentActivityId={scope.activityId} canCreateActivity={canManageSharedResource(user)} />

      <section className="surface-panel relative overflow-hidden rounded-md p-5 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-primary/50" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="terminal-label text-xs font-semibold text-primary">OPS DASHBOARD</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              作战大厅
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {scope.isDaily
                ? "当前范围：日常。集中查看舰队数据准备与日常作业卡。"
                : `当前范围：${scope.label}。集中查看舰队数据准备、锁船矩阵、作业卡与攻略档案的最新状态。`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!scope.isDaily && (
              <Link
                href={scopedPath("/lock-plan", scope.activityId)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/60 bg-primary/18 px-4 py-2 text-sm font-semibold text-sky-100 transition-colors hover:border-primary hover:bg-primary/26"
              >
                <LockKeyhole className="h-4 w-4" />
                进入锁船矩阵
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border-base bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-primary/60 hover:text-sky-100"
            >
              <Database className="h-4 w-4" />
              更新舰籍数据
            </Link>
          </div>
        </div>
      </section>

      <div className={`grid gap-4 ${scope.isDaily ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        <Panel eyebrow="DATA SYNC" title="成员数据状态" status={<StatusBadge variant={missingMembers.length ? "warning" : "success"}>{missingMembers.length ? "CHECK" : "READY"}</StatusBadge>}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold tabular-nums text-white">
                {syncedMembers.length}<span className="text-lg text-slate-500">/{members.length}</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">已同步舰队数据</p>
            </div>
            <RadioTower className="h-9 w-9 text-primary/70" />
          </div>
          <div className="mt-4 min-h-10 text-xs text-slate-500">
            {missingMembers.length > 0 ? (
              <p>未导入：{missingMembers.slice(0, 4).map((member) => member.name).join("、")}{missingMembers.length > 4 ? " 等" : ""}</p>
            ) : (
              <p>全员舰队数据已就绪。</p>
            )}
          </div>
        </Panel>

        {!scope.isDaily && (
          <Panel
            eyebrow="LOCK MATRIX"
            title="锁船状态"
            status={<StatusBadge variant={lockSummary.conflictCount ? "danger" : tags.length ? "default" : "muted"}>{lockSummary.conflictCount ? "CONFLICT" : tags.length ? "ACTIVE" : "EMPTY"}</StatusBadge>}
          >
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-white">{tags.length}</p>
                <p className="mt-1 text-sm text-slate-400">标签数</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-white">{lockSummary.assignedShipCount}</p>
                <p className="mt-1 text-sm text-slate-400">已分配舰船</p>
              </div>
              <div>
                <p className={lockSummary.conflictCount ? "text-3xl font-bold tabular-nums text-red-200" : "text-3xl font-bold tabular-nums text-emerald-200"}>{lockSummary.conflictCount}</p>
                <p className="mt-1 text-sm text-slate-400">冲突</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="terminal-label text-xs text-slate-500">
                LAST SYNC / {formatDateTime(latestLockUpdate)}{latestLockUser ? ` / ${latestLockUser}` : ""}
              </p>
              <Link href={scopedPath("/lock-plan", scope.activityId)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:bg-primary/10 hover:text-sky-100 sm:min-h-6">
                {lockSummary.conflictCount ? "进入冲突筛选" : "进入矩阵"}
              </Link>
            </div>
          </Panel>
        )}

        <Panel eyebrow="ADMIRAL STATUS" title="个人状态" status={<StatusBadge variant="muted">{getRoleLabel(user.role)}</StatusBadge>}>
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name} width={48} height={48} unoptimized className="h-12 w-12 rounded-md object-cover ring-1 ring-border-base" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-md border border-primary/35 bg-primary/10 text-lg font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{user.name}</p>
              <p className="terminal-label text-xs text-slate-500">FOOD / {user.food}</p>
            </div>
          </div>
          <Link href="/profile" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-primary hover:text-sky-200 sm:min-h-6">
            打开个人设置
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </div>

      <div className={`grid gap-4 ${scope.isDaily ? "" : "lg:grid-cols-2"}`}>
        <Panel eyebrow="SORTIE BOARD" title="最近作业卡" actions={<Link href={scopedPath("/routine", scope.activityId)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:bg-primary/10 hover:text-sky-100 sm:min-h-6">查看全部</Link>}>
          {recentRoutine.length === 0 ? (
            <EmptyFeed icon={<ClipboardList className="h-5 w-5" />} title="尚无作业卡" text="建立作业卡后，最近阵容记录会出现在这里。" />
          ) : (
            <div className="space-y-2">
              {recentRoutine.map((record) => (
                <Link
                  key={record.id}
                  href={scopedPath("/routine", scope.activityId)}
                  className="flex items-center justify-between gap-3 rounded-sm border border-border-base/60 bg-slate-950/20 px-3 py-2 text-sm transition-colors hover:border-primary/45"
                >
                  <span className="min-w-0">
                    <span className="terminal-label mr-2 text-xs text-primary">{record.seaArea}</span>
                    <span className="text-slate-100">{record.missionName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{record.user.name}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {!scope.isDaily && (
          <Panel eyebrow="TACTICAL NOTES" title="最近攻略" actions={<Link href={scopedPath("/strategy", scope.activityId)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:bg-primary/10 hover:text-sky-100 sm:min-h-6">查看全部</Link>}>
            {recentStrategy.length === 0 ? (
              <EmptyFeed icon={<FileText className="h-5 w-5" />} title="尚无攻略档案" text="发布攻略后，最近战术档案会出现在这里。" />
            ) : (
              <div className="space-y-2">
                {recentStrategy.map((post) => (
                  <Link
                    key={post.id}
                    href={scopedPath("/strategy", scope.activityId)}
                    className="flex items-center justify-between gap-3 rounded-sm border border-border-base/60 bg-slate-950/20 px-3 py-2 text-sm transition-colors hover:border-primary/45"
                  >
                    <span className="min-w-0">
                      <span className="terminal-label mr-2 text-xs text-primary">{post.phaseName}</span>
                      <span className="text-slate-100">{post.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{post.user.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>

      {missingMembers.length > 0 && (
        <Panel eyebrow="ACTION REQUIRED" title="数据同步提示" status={<StatusBadge variant="warning">NO DATA</StatusBadge>}>
          <div className="flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              仍有成员未导入 noro6 数据，锁船和作业卡选择可能不完整。
            </p>
            <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-md text-primary hover:text-sky-200 sm:min-h-6">前往舰籍数据</Link>
          </div>
        </Panel>
      )}
    </div>
  );
}

function EmptyFeed({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-sm border border-dashed border-border-base/70 bg-slate-950/20 p-4">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-slate-200">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{text}</span>
      </span>
    </div>
  );
}

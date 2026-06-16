"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { DAILY_ACTIVITY_ID, type ActivityOption } from "@/lib/activity-types";

function cx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function scopeHref(pathname: string, activityId: string | null) {
  return activityId ? `${pathname}?activityId=${encodeURIComponent(activityId)}` : pathname;
}

export function ActivitySwitcher({
  activities,
  currentActivityId,
}: {
  activities: ActivityOption[];
  currentActivityId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const currentKey = currentActivityId ?? DAILY_ACTIVITY_ID;

  async function createActivity(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");

    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "创建活动失败");
      return;
    }

    setName("");
    setAdding(false);
    router.push(scopeHref(pathname, data.activity.id));
    router.refresh();
  }

  return (
    <div className="surface-panel rounded-md p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="terminal-label hidden shrink-0 text-[11px] font-semibold text-slate-500 sm:inline">
            OPERATION
          </span>
          <Link
            href={scopeHref(pathname, null)}
            className={cx(
              "shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              currentKey === DAILY_ACTIVITY_ID
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200",
            )}
          >
            日常
          </Link>
          {activities.map((activity) => (
            <Link
              key={activity.id}
              href={scopeHref(pathname, activity.id)}
              className={cx(
                "shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                currentKey === activity.id
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                  : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200",
              )}
            >
              {activity.name}
            </Link>
          ))}
        </div>

        {adding ? (
          <form onSubmit={createActivity} className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              placeholder="活动名"
              className="h-8 w-40 rounded-md border border-slate-700 bg-slate-900/80 px-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/60"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="h-8 rounded-md border border-primary/50 bg-primary/15 px-3 text-xs font-medium text-sky-100 hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setName(""); setError(""); }}
              className="h-8 rounded-md px-2.5 text-xs text-slate-400 hover:bg-slate-700/60 hover:text-slate-200"
            >
              取消
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/40 px-3 text-xs font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" />
            建立活动档案
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface RoutineFilterProps {
  seaAreas: string[];
  uploaders: { id: string; name: string }[];
  currentSearch: string;
  currentSeaArea: string;
  currentUploaderId: string;
  currentActivityId: string | null;
}

export function RoutineFilter({
  seaAreas,
  uploaders,
  currentSearch,
  currentSeaArea,
  currentUploaderId,
  currentActivityId,
}: RoutineFilterProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);

  // Sync search state when URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    setSearch(currentSearch);
  }, [currentSearch]);

  const apply = useCallback(
    (overrides: { search?: string; seaArea?: string; uploaderId?: string }) => {
      const s = overrides.search !== undefined ? overrides.search : search;
      const sa = overrides.seaArea !== undefined ? overrides.seaArea : currentSeaArea;
      const uid = overrides.uploaderId !== undefined ? overrides.uploaderId : currentUploaderId;

      // Rebuild params from scratch for cleanliness
      const next = new URLSearchParams();
      if (currentActivityId) next.set("activityId", currentActivityId);
      if (s) next.set("search", s);
      if (sa) next.set("seaArea", sa);
      if (uid) next.set("uploaderId", uid);
      const qs = next.toString();
      router.push(qs ? `/routine?${qs}` : "/routine");
    },
    [router, search, currentSeaArea, currentUploaderId, currentActivityId],
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply({ search: search.trim() });
  }

  function handleSeaAreaChange(value: string) {
    apply({ seaArea: value });
  }

  function handleUploaderChange(value: string) {
    apply({ uploaderId: value });
  }

  function handleClear() {
    setSearch("");
    router.push(currentActivityId ? `/routine?activityId=${encodeURIComponent(currentActivityId)}` : "/routine");
  }

  const hasFilter = currentSearch || currentSeaArea || currentUploaderId;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索海域/任务/备注..."
          className="w-48 pr-8 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); apply({ search: "" }); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
          >
            ✕
          </button>
        )}
      </form>

      {/* Sea Area dropdown */}
      <select
        value={currentSeaArea}
        onChange={(e) => handleSeaAreaChange(e.target.value)}
        className="rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
      >
        <option value="">全部海图</option>
        {seaAreas.map((sa) => (
          <option key={sa} value={sa}>
            {sa}
          </option>
        ))}
      </select>

      {/* Uploader dropdown */}
      <select
        value={currentUploaderId}
        onChange={(e) => handleUploaderChange(e.target.value)}
        className="rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
      >
        <option value="">全部上传者</option>
        {uploaders.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilter && (
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all shrink-0"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}

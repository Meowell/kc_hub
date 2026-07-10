"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Search, X } from "lucide-react";

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
    <div className="surface-panel-subtle flex flex-col items-stretch gap-2 rounded-md p-2 sm:flex-row sm:items-center">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索海域/任务/备注..."
          className="w-full border-slate-600 !bg-slate-900 pl-9 pr-12 sm:w-56"
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); apply({ search: "" }); }}
            className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-100"
            aria-label="清除搜索"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {/* Sea Area dropdown */}
      <Select
        value={currentSeaArea}
        onChange={(e) => handleSeaAreaChange(e.target.value)}
        className="border-slate-600 sm:w-36"
      >
        <option value="">全部海图</option>
        {seaAreas.map((sa) => (
          <option key={sa} value={sa}>
            {sa}
          </option>
        ))}
      </Select>

      {/* Uploader dropdown */}
      <Select
        value={currentUploaderId}
        onChange={(e) => handleUploaderChange(e.target.value)}
        className="border-slate-600 sm:w-36"
      >
        <option value="">全部上传者</option>
        {uploaders.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>

      {/* Clear filters */}
      {hasFilter && (
        <button
          type="button"
          onClick={handleClear}
          className="min-h-11 shrink-0 rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:border-red-500/30 hover:text-red-300"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}

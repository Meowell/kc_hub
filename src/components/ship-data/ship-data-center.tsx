"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Ship, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActivityOverview } from "@/lib/activity-overview";
import {
  getLockTagColorClassName,
  getLockTagColorStyle,
  isCustomLockTagColor,
} from "@/lib/lock-tag-colors";
import { createMasterLookup } from "@/lib/master-data";
import { parseNoro6Data, type Noro6Preview } from "@/lib/noro6";
import { useMasterData } from "@/lib/use-master-data";
import { filterRowsByLockTag } from "@/lib/frontend-ux";

function baseMin(raw: number | number[] | undefined): number {
  if (Array.isArray(raw)) return raw[0] ?? 0;
  if (typeof raw === "number") return raw;
  return 0;
}

// ---- Ship row type ----

type ShipRow = {
  rowId: string;
  id: number;
  orig: number;
  name: string;
  stype: number;
  stypeName: string;
  lv: number;
  hp: number;
  fire: number;
  torpedo: number;
  armor: number;
  asw: number;
  luck: number;
};

// ---- Helpers ----

function levelColor(level: number): string {
  if (level >= 100) return "text-amber-400";
  if (level >= 80) return "text-green-400";
  if (level >= 50) return "text-blue-400";
  return "text-slate-500";
}

type SortKey = "id" | "lv" | "hp" | "fire" | "torpedo" | "armor" | "asw" | "luck";

const statHeaders: { key: SortKey; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "fire", label: "火" },
  { key: "torpedo", label: "雷" },
  { key: "armor", label: "甲" },
  { key: "asw", label: "潜" },
  { key: "luck", label: "运" },
];

type DashboardLockTag = {
  id: string;
  name: string;
  colorClass: string;
  sortOrder: number;
};

type ViewerOption = { id: string; name: string };

function ViewerDropdown({
  currentUserName,
  viewerId,
  loading,
  onSwitch,
}: {
  currentUserName: string;
  viewerId: string | null;
  loading: boolean;
  onSwitch: (uid: string | null) => void;
}) {
  const [users, setUsers] = useState<ViewerOption[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/users/list", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("无法加载用户列表");
        return response.json();
      })
      .then((data: ViewerOption[]) => setUsers(data))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-w-0">
      <label htmlFor="ship-viewer" className="sr-only">选择舰籍视角</label>
      <select
        id="ship-viewer"
        value={viewerId ?? ""}
        disabled={loading || loadError}
        aria-busy={loading}
        onChange={(event) => onSwitch(event.target.value || null)}
        className="min-h-11 w-full max-w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-base text-slate-100 outline-none focus:border-primary sm:min-h-9 sm:w-auto sm:text-sm"
      >
        <option value="">视角：{currentUserName}</option>
        {users.map((user) => <option key={user.id} value={user.id}>视角：{user.name}</option>)}
      </select>
      {loadError && <p role="alert" className="mt-1 text-xs text-red-300">用户列表加载失败，请刷新重试。</p>}
    </div>
  );
}

// ---- Component ----

function formatSyncTime(value: string | null) {
  if (!value) return "尚未同步";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShipDataCenter({
  initialShipData,
  initialLastShipDataUpdatedAt,
  currentUserName,
  currentActivityName,
  lockTags,
  lockAssignmentsByTagId,
  activityOverview,
}: {
  initialShipData: string;
  initialLastShipDataUpdatedAt: string | null;
  currentUserName: string;
  currentActivityName: string;
  lockTags: DashboardLockTag[];
  lockAssignmentsByTagId: Record<string, string[]>;
  activityOverview: ActivityOverview;
}) {
  const { masterData, error: masterDataError, isLoading: masterDataLoading } = useMasterData();
  const masterLookup = useMemo(() => createMasterLookup(masterData), [masterData]);
  const [shipData, setShipData] = useState(initialShipData);
  const [lastShipDataUpdatedAt, setLastShipDataUpdatedAt] = useState<string | null>(initialLastShipDataUpdatedAt);
  const [inputData, setInputData] = useState("");
  const [preview, setPreview] = useState<Noro6Preview | null>(null);
  const [previewSource, setPreviewSource] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [selectedLockTagId, setSelectedLockTagId] = useState<string>("all");
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const canEditCurrentView = viewerId === null;
  const viewerRequestRef = useRef<AbortController | null>(null);
  const viewerCacheRef = useRef(new Map<string, { shipData: string; lastShipDataUpdatedAt: string | null }>([
    ["self", { shipData: initialShipData, lastShipDataUpdatedAt: initialLastShipDataUpdatedAt }],
  ]));

  async function switchViewer(uid: string | null) {
    viewerRequestRef.current?.abort();
    setError("");
    setMessage("");
    const cacheKey = uid ?? "self";
    const cached = viewerCacheRef.current.get(cacheKey);
    if (cached) {
      setViewerId(uid);
      setShipData(cached.shipData);
      setLastShipDataUpdatedAt(cached.lastShipDataUpdatedAt);
      setPreview(null);
      setPreviewSource("");
      return;
    }
    if (!uid) {
      setViewerId(null);
      setShipData(viewerCacheRef.current.get("self")?.shipData ?? initialShipData);
      setLastShipDataUpdatedAt(viewerCacheRef.current.get("self")?.lastShipDataUpdatedAt ?? initialLastShipDataUpdatedAt);
      setPreview(null);
      setPreviewSource("");
      return;
    }
    const controller = new AbortController();
    viewerRequestRef.current = controller;
    setViewerLoading(true);
    try {
      const res = await fetch(`/api/users/ship-data?userId=${encodeURIComponent(uid)}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || data.shipData === undefined) throw new Error(data.error ?? "视角数据加载失败");
      const next = { shipData: data.shipData as string, lastShipDataUpdatedAt: data.lastShipDataUpdatedAt ?? null };
      viewerCacheRef.current.set(uid, next);
      setViewerId(uid);
      setShipData(next.shipData);
      setLastShipDataUpdatedAt(next.lastShipDataUpdatedAt);
      setPreview(null);
      setPreviewSource("");
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "视角数据加载失败，请重试。");
    } finally {
      if (viewerRequestRef.current === controller) {
        viewerRequestRef.current = null;
        setViewerLoading(false);
      }
    }
  }

  useEffect(() => () => viewerRequestRef.current?.abort(), []);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("lv");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const parsedShips = useMemo(() => {
    if (!shipData.trim()) return [] as ShipRow[];
    try {
      return parseNoro6Data(shipData).ships.map((ship, index) => {
        const base = masterLookup.shipBaseById.get(ship.id);
        const mod = ship.st ?? [];
        return {
          rowId: `${ship.id}-${index}`,
          id: ship.id,
          orig: masterLookup.origByShipId.get(ship.id) ?? ship.id,
          name: masterLookup.shipNameById.get(ship.id) ?? `未知舰船 ID ${ship.id}`,
          stype: base ? base.api_stype : 0,
          stypeName: base ? (masterLookup.stypeNameById.get(base.api_stype) ?? "未知") : "未知",
          lv: ship.lv,
          hp:
            (() => {
              if (!base) return 0;
              const hpData = masterLookup.shipHpById.get(ship.id);
              const baseHp = hpData ? (ship.lv > 99 ? hpData.hp2 : hpData.hp) : baseMin(base.api_taik);
              return baseHp + (mod[5] ?? 0);
            })(),
          fire: (base ? baseMin(base.api_houg) : 0) + (mod[0] ?? 0),
          torpedo: (base ? baseMin(base.api_raig) : 0) + (mod[1] ?? 0),
          armor: (base ? baseMin(base.api_souk) : 0) + (mod[3] ?? 0),
          asw: mod[6] ?? 0,
          luck: (base ? baseMin(base.api_luck) : 0) + (mod[4] ?? 0),
        };
      });
    } catch {
      return [] as ShipRow[];
    }
  }, [shipData, masterLookup]);

  const sortedShips = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...parsedShips].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }, [parsedShips, sortKey, sortDir]);

  // Filter state
  const [stypeFilter, setStypeFilter] = useState<number>(0);
  const [searchText, setSearchText] = useState("");

  // Derive stype options from current ships
  const stypeOptions = useMemo(() => {
    const seen = new Set<number>();
    const opts: { id: number; name: string }[] = [];
    for (const s of parsedShips) {
      if (s.stype && !seen.has(s.stype)) {
        seen.add(s.stype);
        opts.push({ id: s.stype, name: s.stypeName });
      }
    }
    opts.sort((a, b) => a.id - b.id);
    return opts;
  }, [parsedShips]);

  const filteredShips = useMemo(() => {
    let list = sortedShips;
    list = filterRowsByLockTag(list, selectedLockTagId, lockAssignmentsByTagId);
    if (stypeFilter !== 0) {
      list = list.filter((s) => s.stype === stypeFilter);
    }
    const kw = searchText.trim().toLowerCase();
    if (kw) {
      list = list.filter((s) => s.name.toLowerCase().includes(kw));
    }
    return list;
  }, [lockAssignmentsByTagId, searchText, selectedLockTagId, sortedShips, stypeFilter]);


  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") {
        setSortDir("asc");
      } else {
        // Third click: back to default (Lv desc)
        setSortKey("lv");
        setSortDir("desc");
      }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return "↕";
    return sortDir === "desc" ? "↓" : "↑";
  }

  const parsedItems = useMemo(() => {
    if (!shipData.trim()) return [];
    try {
      const countByKey = new Map<string, number>();
      for (const item of parseNoro6Data(shipData).items) {
        const lv = item.lv ?? 0;
        const key = `${item.id}:${lv}`;
        countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
      }
      return Array.from(countByKey.entries())
        .map(([key, count]) => {
          const [idStr, lvStr] = key.split(":");
          const id = Number(idStr);
          const lv = Number(lvStr);
          return {
            rowId: key,
            id,
            lv,
            name: masterLookup.equipNameById.get(id) ?? `未知装备 ID ${id}`,
            count,
          };
        })
        .sort((a, b) => a.id - b.id || a.lv - b.lv);
    } catch {
      return [];
    }
  }, [shipData, masterLookup]);

  // Equipment filter & sort state
  const [equipSortKey, setEquipSortKey] = useState<"id" | "lv" | "count">("id");
  const [equipSortDir, setEquipSortDir] = useState<"asc" | "desc">("asc");
  const [equipSearchText, setEquipSearchText] = useState("");
  const [equipTypeFilter, setEquipTypeFilter] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const equipTypeOptions = useMemo(() => {
    const seen = new Set<number>();
    const opts: { id: number; name: string }[] = [];
    for (const item of parsedItems) {
      const tid = masterLookup.equipTypeById.get(item.id) ?? 0;
      if (tid && !seen.has(tid)) {
        seen.add(tid);
        opts.push({ id: tid, name: masterLookup.equipTypeNameById.get(tid) ?? `类型${tid}` });
      }
    }
    opts.sort((a, b) => a.id - b.id);
    return opts;
  }, [parsedItems, masterLookup]);

  const filteredItems = useMemo(() => {
    let list = parsedItems;
    if (equipTypeFilter !== 0) {
      list = list.filter((item) => (masterLookup.equipTypeById.get(item.id) ?? 0) === equipTypeFilter);
    }
    const kw = equipSearchText.trim().toLowerCase();
    if (kw) {
      list = list.filter((item) => item.name.toLowerCase().includes(kw));
    }
    const dir = equipSortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => (a[equipSortKey] - b[equipSortKey]) * dir);
  }, [parsedItems, equipSortKey, equipSortDir, equipSearchText, equipTypeFilter, masterLookup]);

  // 折叠/展开：同ID装备默认折叠，展开后显示各改修等级
  const displayItems = useMemo(() => {
    // 先按ID聚合成组，计算总数量和总星数
    const byId = new Map<number, { items: typeof filteredItems; totalCount: number; totalLv: number }>();
    for (const item of filteredItems) {
      let g = byId.get(item.id);
      if (!g) {
        g = { items: [], totalCount: 0, totalLv: 0 };
        byId.set(item.id, g);
      }
      g.items.push(item);
      g.totalCount += item.count;
      g.totalLv += item.lv * item.count;
    }
    // 按当前排序键排列组
    const groups = Array.from(byId.values());
    const dir = equipSortDir === "desc" ? -1 : 1;
    groups.sort((a, b) => {
      if (equipSortKey === "lv") return (a.totalLv - b.totalLv) * dir;
      if (equipSortKey === "count") return (a.totalCount - b.totalCount) * dir;
      return (a.items[0].id - b.items[0].id) * dir;
    });

    // 展开为显示行
    const result: (typeof filteredItems[number] & { isGroup: boolean; totalCount: number })[] = [];
    for (const g of groups) {
      const rep = g.items[0];
      result.push({ ...rep, lv: 0, count: g.totalCount, isGroup: true, totalCount: g.totalCount });
      if (expandedIds.has(rep.id)) {
        const subs = [...g.items].sort((a, b) => b.lv - a.lv);
        for (const sub of subs) {
          result.push({ ...sub, isGroup: false, totalCount: 0 });
        }
      }
    }
    return result;
  }, [filteredItems, expandedIds, equipSortKey, equipSortDir]);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }


  function handleEquipSort(key: "id" | "lv" | "count") {
    if (equipSortKey === key) {
      if (equipSortDir === "desc") {
        setEquipSortDir("asc");
      } else {
        setEquipSortKey("id");
        setEquipSortDir("asc");
      }
    } else {
      setEquipSortKey(key);
      setEquipSortDir("desc");
    }
  }

  function equipSortIcon(key: "id" | "lv" | "count") {
    if (equipSortKey !== key) return "↕";
    return equipSortDir === "desc" ? "↓" : "↑";
  }

  const selectedLockTag = useMemo(
    () => lockTags.find((tag) => tag.id === selectedLockTagId) ?? null,
    [lockTags, selectedLockTagId],
  );

  useEffect(() => {
    if (selectedLockTagId === "all" || selectedLockTagId === "unassigned" || lockTags.some((tag) => tag.id === selectedLockTagId)) return;
    setSelectedLockTagId("all");
  }, [lockTags, selectedLockTagId]);

  async function onPreview(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setMessage("");
    setError("");
    setPreview(null);
    setPreviewSource("");
    if (!canEditCurrentView) {
      setError("当前为他人视角，只能查看，不能更新舰队数据。");
      return;
    }
    if (!inputData.trim()) {
      setError("请粘贴 noro6 存档数据");
      return;
    }
    setIsPreviewing(true);
    try {
      const res = await fetch("/api/ship-data/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipData: inputData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "解析失败");
        return;
      }
      setPreview(data.preview);
      setPreviewSource(inputData);
      setMessage("解析完成，请确认预览后更新。");
    } catch {
      setError("解析失败，请检查网络后重试。");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function savePreview() {
    setMessage("");
    setError("");
    if (!preview) {
      setError("请先解析预览");
      return;
    }
    if (previewSource !== inputData) {
      setError("输入内容已变化，请重新解析预览。");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/users/ship-data", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipData: preview.normalizedData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setShipData(preview.normalizedData);
      const updatedAt = data.lastShipDataUpdatedAt ?? new Date().toISOString();
      setLastShipDataUpdatedAt(updatedAt);
      viewerCacheRef.current.set("self", { shipData: preview.normalizedData, lastShipDataUpdatedAt: updatedAt });
      setInputData("");
      setPreview(null);
      setPreviewSource("");
      setMessage("舰娘/装备数据已更新");
    } catch {
      setError("保存失败，请检查网络后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  const cardBase =
    "min-w-0 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm shadow-lg shadow-black/10";
  const topCardClass = "lg:min-h-[280px]";

  const thClass =
    "text-center px-1.5 font-medium text-slate-400 select-none transition-colors";

  function ThSort({ label, sortKey: key }: { label: string; sortKey: SortKey }) {
    return (
      <th
        className={cn(thClass, key === "id" || key === "lv" ? "w-10" : "w-11")}
        aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button type="button" onClick={() => handleSort(key)} className="inline-flex min-h-11 w-full items-center justify-center gap-0.5 hover:text-slate-200">
          {label}
          <span className="w-3 text-center">{sortIcon(key)}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {masterDataLoading && <p role="status" className="rounded-md border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-sky-100">正在加载舰船与装备主数据…</p>}
      {masterDataError && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">主数据加载失败，当前仅显示可识别的基础数据。刷新页面可重试。</p>}
      {/* Row 1: noro6 import card + placeholders */}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-3">
        {/* noro6 import card */}
        <div className={cn(cardBase, topCardClass, "p-4")}>
          <form onSubmit={onPreview} className="h-full space-y-2.5 lg:overflow-y-auto lg:pr-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="text-sm font-semibold text-white">DATA SYNC / 数据同步</h2>
              </div>
              <ViewerDropdown currentUserName={currentUserName} viewerId={viewerId} loading={viewerLoading} onSwitch={switchViewer} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <StatusBadge variant={canEditCurrentView ? "default" : "muted"}>
                {canEditCurrentView ? "OWN DATA / 当前用户" : "VIEW ONLY / 他人视角"}
              </StatusBadge>
              <span>最后同步：{formatSyncTime(lastShipDataUpdatedAt)}</span>
            </div>
            <Textarea
              className="min-h-20 font-mono text-xs"
              value={inputData}
              disabled={!canEditCurrentView}
              onChange={(e) => {
                setInputData(e.target.value);
                setPreview(null);
                setPreviewSource("");
                setMessage("");
              }}
              placeholder={canEditCurrentView ? "粘贴舰船/装备/完整外部链接数据" : "他人视角下不能更新舰队数据"}
            />
            {preview && (
              <Panel
                dense
                eyebrow="PARSE PREVIEW"
                title="解析预览"
                status={<StatusBadge variant={preview.unknownShipIds.length || preview.unknownEquipmentIds.length ? "warning" : "success"}>{preview.unknownShipIds.length || preview.unknownEquipmentIds.length ? "CHECK / 待确认" : "READY / 可更新"}</StatusBadge>}
              >
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div><span className="text-slate-500">舰船</span><p className="font-semibold text-white">{preview.shipCount} 艘</p></div>
                  <div><span className="text-slate-500">装备</span><p className="font-semibold text-white">{preview.equipmentCount} 件</p></div>
                  <div><span className="text-slate-500">舰种</span><p className="font-semibold text-white">{preview.shipTypeCount} 类</p></div>
                  <div><span className="text-slate-500">装备数据</span><p className="font-semibold text-white">{preview.hasEquipmentData ? "包含" : "未包含"}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-sm border border-border-base bg-slate-950/25 p-2">
                    <span className="text-slate-500">舰船变化</span>
                    <p className="mt-1 text-slate-200">新增 {preview.addedShipCount} / 减少 {preview.removedShipCount}</p>
                  </div>
                  <div className="rounded-sm border border-border-base bg-slate-950/25 p-2">
                    <span className="text-slate-500">装备变化</span>
                    <p className="mt-1 text-slate-200">新增 {preview.addedEquipmentCount} / 减少 {preview.removedEquipmentCount}</p>
                  </div>
                </div>
                {(preview.unknownShipIds.length > 0 || preview.unknownEquipmentIds.length > 0) && (
                  <div className="mt-3 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-amber-200">
                    {preview.unknownShipIds.length > 0 && <p>未知舰船 ID：{preview.unknownShipIds.join(", ")}</p>}
                    {preview.unknownEquipmentIds.length > 0 && <p>未知装备 ID：{preview.unknownEquipmentIds.join(", ")}</p>}
                  </div>
                )}
              </Panel>
            )}
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                {message}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="submit" disabled={isPreviewing || isSaving || !canEditCurrentView} className="h-8 text-xs">
                {isPreviewing ? "解析中..." : "解析预览"}
              </Button>
              <Button
                type="button"
                disabled={!preview || isSaving || isPreviewing || !canEditCurrentView}
                className="h-8 text-xs"
                onClick={savePreview}
              >
                {isSaving ? "更新中..." : "确认更新"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs sm:col-span-2"
                onClick={() => {
                  navigator.clipboard.writeText(inputData).then(
                    () => setMessage("已复制到剪贴板"),
                  );
                }}
              >
                复制输入
              </Button>
            </div>
          </form>
        </div>

        <div className={cn(cardBase, topCardClass, "order-3 flex flex-col lg:order-2")}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 px-4 py-4">
            <div className="min-w-0">
              <p className="terminal-label text-[10px] font-semibold text-primary">LOCK TAGS</p>
              <h2 className="truncate text-sm font-semibold text-white">锁船标签</h2>
            </div>
            <StatusBadge variant={lockTags.length > 0 ? "default" : "muted"}>
              {lockTags.length} TAGS
            </StatusBadge>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLockTagId("all")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    selectedLockTagId === "all"
                      ? "border-primary/60 bg-primary/15 text-sky-100"
                      : "border-slate-700/70 bg-slate-950/25 text-slate-400 hover:border-primary/35 hover:text-slate-200",
                  )}
                >
                  全部贴条
                </button>
                {lockTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedLockTagId(tag.id)}
                    className={cn(
                      "rounded-md px-3 py-2 text-xs font-bold transition-all hover:ring-2 hover:ring-white/30",
                      getLockTagColorClassName(tag.colorClass),
                      !isCustomLockTagColor(tag.colorClass) && "text-slate-900",
                      selectedLockTagId === tag.id && "ring-2 ring-primary/80 ring-offset-2 ring-offset-slate-900",
                    )}
                    style={getLockTagColorStyle(tag.colorClass)}
                  >
                    {tag.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedLockTagId("unassigned")}
                  className={cn(
                    "min-h-11 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    selectedLockTagId === "unassigned"
                      ? "border-primary/60 bg-primary/15 text-sky-100"
                      : "border-slate-700/70 bg-slate-950/25 text-slate-300 hover:border-primary/35",
                  )}
                >
                  未贴条
                </button>
              </div>
            </div>
            <div className="mt-auto rounded-md border border-slate-700/60 bg-slate-950/25 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">ACTIVE FILTER</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                {selectedLockTagId === "unassigned" ? "未贴条" : selectedLockTag ? selectedLockTag.name : "全部贴条"}
              </p>
              <p className="mt-1 text-xs text-slate-400">显示 {filteredShips.length} / {parsedShips.length} 艘</p>
            </div>
          </div>
        </div>

        <div className={cn(cardBase, topCardClass, "order-2 flex flex-col lg:order-3")}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 px-4 py-4">
            <div className="min-w-0">
              <p className="terminal-label text-[10px] font-semibold text-primary">EVENT INTEL</p>
              <h2 className="truncate text-sm font-semibold text-white">活动情报</h2>
            </div>
            <StatusBadge variant={activityOverview.maps.length > 0 ? "success" : "warning"}>
              {activityOverview.status ?? "INFO"}
            </StatusBadge>
          </div>
          <div className="min-h-0 flex-1 space-y-3 p-4 lg:overflow-y-auto lg:pr-3">
            <div>
              <p className="text-base font-bold text-white">{activityOverview.title}</p>
              <p className="mt-1 text-xs text-slate-500">{activityOverview.subtitle ?? currentActivityName}</p>
            </div>
            {activityOverview.announcements.length > 0 && (
              <button
                type="button"
                onClick={() => setAnnouncementOpen(true)}
                className="flex w-full items-start justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/15"
              >
                <span className="min-w-0">
                  <span className="terminal-label block text-[10px] text-primary">NOTICE</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-sky-100">作战公告</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                    {activityOverview.announcements[0].title}
                  </span>
                </span>
                <span className="shrink-0 rounded-sm border border-primary/35 bg-slate-950/35 px-2 py-0.5 text-xs font-semibold text-sky-100">
                  {activityOverview.announcements.length} 条
                </span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {activityOverview.period && (
                <div className="rounded-sm border border-slate-700/60 bg-slate-950/25 p-2">
                  <p className="terminal-label text-[10px] text-slate-500">PERIOD</p>
                  <p className="mt-1 text-slate-200">{activityOverview.period}</p>
                </div>
              )}
              {activityOverview.scale && (
                <div className="rounded-sm border border-slate-700/60 bg-slate-950/25 p-2">
                  <p className="terminal-label text-[10px] text-slate-500">SCALE</p>
                  <p className="mt-1 text-slate-200">{activityOverview.scale}</p>
                </div>
              )}
              {activityOverview.frontOperation && (
                <div className="rounded-sm border border-slate-700/60 bg-slate-950/25 p-2">
                  <p className="terminal-label text-[10px] text-slate-500">FRONT</p>
                  <p className="mt-1 text-slate-200">{activityOverview.frontOperation}</p>
                </div>
              )}
              {activityOverview.rearOperation && (
                <div className="rounded-sm border border-slate-700/60 bg-slate-950/25 p-2">
                  <p className="terminal-label text-[10px] text-slate-500">REAR</p>
                  <p className="mt-1 text-slate-200">{activityOverview.rearOperation}</p>
                </div>
              )}
            </div>
            {activityOverview.maps.length > 0 && (
              <div>
                <p className="terminal-label mb-1.5 text-[10px] text-slate-500">MAPS</p>
                <div className="space-y-1.5">
                  {activityOverview.maps.map((map) => (
                    <div key={map.code} className="rounded-sm border border-slate-700/60 bg-slate-950/25 px-2 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-100">
                            {map.code} / {map.operation}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{map.area}</p>
                        </div>
                        {map.phase && <span className="shrink-0 text-[11px] text-sky-200">{map.phase}</span>}
                      </div>
                      {map.tags && map.tags.length > 0 && (
                        <p className="mt-1 truncate text-[11px] text-slate-400">{map.tags.join(" / ")}</p>
                      )}
                      {map.note && <p className="mt-1 text-[11px] text-amber-200">{map.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activityOverview.rewards.length > 0 && (
              <div>
                <p className="terminal-label mb-1.5 text-[10px] text-slate-500">REWARDS</p>
                <div className="grid gap-1.5">
                  {activityOverview.rewards.map((reward) => (
                    <div key={`${reward.label}-${reward.value}`} className="rounded-sm border border-slate-700/60 bg-slate-950/25 px-2 py-1.5 text-xs">
                      <span className="text-slate-500">{reward.label}</span>
                      <p className="mt-1 break-words font-semibold leading-relaxed text-slate-100">{reward.value}</p>
                      {reward.note && <p className="mt-1 text-[11px] text-slate-500">{reward.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activityOverview.notes.length > 0 && (
              <div className="rounded-sm border border-amber-500/25 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-100">
                {activityOverview.notes.map((note) => <p key={note}>{note}</p>)}
              </div>
            )}
            {activityOverview.updatedAt && (
              <p className="terminal-label text-[10px] text-slate-600">UPDATED {activityOverview.updatedAt}</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: 拥有舰船 (wider) + 拥有装备 (wide) */}
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row">
        {/* 拥有舰船 */}
        <div className={`${cardBase} w-full lg:w-[560px] lg:shrink-0`}>
          <div className="flex flex-col gap-3 border-b border-slate-700/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <Ship className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-white">拥有舰船</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {(() => { const ids = new Set(filteredShips.map(s => s.orig)); return ids.size; })()}
                /
                {(() => {
                  const kw = searchText.trim().toLowerCase();
                  const ids = new Set<number>();
                  for (const entry of masterData.shipHp) {
                    const b = masterLookup.shipBaseById.get(entry.id);
                    if (stypeFilter !== 0 && (!b || b.api_stype !== stypeFilter)) continue;
                    if (kw) {
                      const n = masterLookup.shipNameById.get(entry.id);
                      if (!n || !n.toLowerCase().includes(kw)) continue;
                    }
                    ids.add(masterLookup.origByShipId.get(entry.id) ?? entry.id);
                  }
                  return ids.size;
                })()}种
              </span>
              <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {filteredShips.length}艘
              </span>
            </div>
          </div>
          {parsedShips.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {shipData.trim() ? "" : "暂无舰船数据"}
            </p>
          ) : (
            <>
              {/* Filter bar */}
              <div className="grid grid-cols-1 gap-2 border-b border-slate-700/30 bg-slate-800/50 px-4 py-2 sm:flex sm:items-center">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜索舰名..."
                  className="min-w-0 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-500/50 sm:flex-1"
                />
                <select
                  value={stypeFilter}
                  onChange={(e) => setStypeFilter(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50 sm:w-auto"
                >
                  <option value={0}>全部舰种</option>
                  {stypeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {(stypeFilter !== 0 || searchText.trim()) && (
                  <button
                    onClick={() => { setStypeFilter(0); setSearchText(""); }}
                    className="justify-self-start text-xs text-slate-500 hover:text-slate-300 sm:shrink-0"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[520px] table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                  <tr className="border-b border-slate-700/50">
                    <ThSort label="ID" sortKey="id" />
                    <ThSort label="Lv" sortKey="lv" />
                    <th className="text-left px-2 py-2.5 font-medium text-slate-400">
                      舰船名
                    </th>
                    {statHeaders.map((h) => (
                      <ThSort key={h.key} label={h.label} sortKey={h.key} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShips.map((ship) => (
                    <tr
                      key={ship.rowId}
                      className="border-t border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-1 py-2 text-center text-slate-500 tabular-nums text-xs">
                        {ship.id}
                      </td>
                      <td className="px-1 py-2 text-center tabular-nums text-xs">
                        <span className={cn("font-semibold", levelColor(ship.lv))}>
                          {ship.lv}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-slate-200 font-medium text-xs truncate">
                        {ship.name}
                      </td>
                      {statHeaders.map((h) => (
                        <td
                          key={h.key}
                          className="px-1 py-2 text-center tabular-nums text-xs"
                        >
                          <span className="font-semibold text-slate-200">
                            {ship[h.key]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>

        {/* 拥有装备 */}
        <div className={`${cardBase} flex-1`}>
          <div className="flex flex-col gap-3 border-b border-slate-700/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-white">拥有装备</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {(() => { const ids = new Set(filteredItems.map(i => i.id)); return ids.size; })()}种
              </span>
              <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {filteredItems.reduce((s, i) => s + i.count, 0)}件
              </span>
            </div>
          </div>
          {parsedItems.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {shipData.trim() ? "" : "暂无装备数据"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 border-b border-slate-700/30 bg-slate-800/50 px-4 py-2 sm:flex sm:items-center">
                <input
                  type="text"
                  value={equipSearchText}
                  onChange={(e) => setEquipSearchText(e.target.value)}
                  placeholder="搜索装备名..."
                  className="min-w-0 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-500/50 sm:flex-1"
                />
                <select
                  value={equipTypeFilter}
                  onChange={(e) => setEquipTypeFilter(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50 sm:w-auto"
                >
                  <option value={0}>全部装备</option>
                  {equipTypeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {(equipTypeFilter !== 0 || equipSearchText.trim()) && (
                  <button
                    onClick={() => { setEquipTypeFilter(0); setEquipSearchText(""); }}
                    className="justify-self-start text-xs text-slate-500 hover:text-slate-300 sm:shrink-0"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[520px] table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-400 sm:px-5">
                      装备名
                    </th>
                    <th
                      aria-sort={equipSortKey === "id" ? (equipSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="w-12 px-3 text-center font-medium text-slate-400"
                    >
                      <button type="button" onClick={() => handleEquipSort("id")} className="inline-flex min-h-11 w-full items-center justify-center gap-0.5 hover:text-slate-200">
                        ID<span className="w-3 text-center">{equipSortIcon("id")}</span>
                      </button>
                    </th>
                    <th
                      aria-sort={equipSortKey === "lv" ? (equipSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="w-16 px-4 text-center font-medium text-slate-400"
                    >
                      <button type="button" onClick={() => handleEquipSort("lv")} className="inline-flex min-h-11 w-full items-center justify-center gap-0.5 whitespace-nowrap hover:text-slate-200">
                        改修<span className="w-3 text-center">{equipSortIcon("lv")}</span>
                      </button>
                    </th>
                    <th
                      aria-sort={equipSortKey === "count" ? (equipSortDir === "asc" ? "ascending" : "descending") : "none"}
                      className="w-16 px-4 text-center font-medium text-slate-400"
                    >
                      <button type="button" onClick={() => handleEquipSort("count")} className="inline-flex min-h-11 w-full items-center justify-center gap-0.5 whitespace-nowrap hover:text-slate-200">
                        数量<span className="w-3 text-center">{equipSortIcon("count")}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => (
                    <tr
                      key={item.isGroup ? `g-${item.id}` : item.rowId}
                      className={cn(
                        "border-t border-slate-700/30 transition-colors",
                        item.isGroup ? "hover:bg-slate-700/30 cursor-pointer" : "bg-slate-800/40",
                      )}
                      onClick={() => item.isGroup && toggleExpand(item.id)}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-200 sm:px-5">
                        <span className={cn("block truncate", item.isGroup ? "" : "pl-4")}>
                          {item.isGroup && (
                            <span className="text-slate-500 text-xs mr-1.5">
                              {expandedIds.has(item.id) ? "▼" : "▶"}
                            </span>
                          )}
                          {item.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">
                        {item.id}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {item.isGroup ? (
                          <span className="text-slate-600 text-xs">
                            {filteredItems.filter(i => i.id === item.id).length} 档
                          </span>
                        ) : (
                          <span className={item.lv > 0 ? "font-semibold text-amber-400" : "text-slate-500"}>
                            {item.lv > 0 ? `改修 +${item.lv}` : "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        <span className="font-semibold text-emerald-400">
                          {item.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {displayItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                        无匹配装备
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>作战公告</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
            {activityOverview.announcements.map((announcement, index) => (
              <article
                key={`${announcement.number ?? index}-${announcement.title}`}
                className="rounded-md border border-slate-700/70 bg-slate-950/35 p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="terminal-label shrink-0 rounded-sm border border-primary/35 bg-primary/10 px-2 py-1 text-xs text-sky-100">
                    {announcement.number ?? String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{announcement.title}</h3>
                    {announcement.tag && (
                      <p className="terminal-label mt-1 text-[10px] text-primary">{announcement.tag}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {announcement.body}
                </div>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createMasterLookup } from "@/lib/master-data";
import { parseNoro6Data, type Noro6Preview } from "@/lib/noro6";
import { useMasterData } from "@/lib/use-master-data";

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
}: {
  initialShipData: string;
  initialLastShipDataUpdatedAt: string | null;
  currentUserName: string;
}) {
  const { masterData } = useMasterData();
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
  const canEditCurrentView = viewerId === null;

  async function switchViewer(uid: string | null) {
    if (!uid) {
      setViewerId(null);
      setShipData(initialShipData);
      setLastShipDataUpdatedAt(initialLastShipDataUpdatedAt);
      setPreview(null);
      setPreviewSource("");
      return;
    }
    setViewerId(uid);
    setPreview(null);
    setPreviewSource("");
    try {
      const res = await fetch(`/api/users/ship-data?userId=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (data.shipData !== undefined) {
        setShipData(data.shipData);
        setLastShipDataUpdatedAt(data.lastShipDataUpdatedAt ?? null);
      }
    } catch { /* ignore */ }
  }

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
    if (stypeFilter !== 0) {
      list = list.filter((s) => s.stype === stypeFilter);
    }
    const kw = searchText.trim().toLowerCase();
    if (kw) {
      list = list.filter((s) => s.name.toLowerCase().includes(kw));
    }
    return list;
  }, [sortedShips, stypeFilter, searchText]);


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
      setLastShipDataUpdatedAt(data.lastShipDataUpdatedAt ?? new Date().toISOString());
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

  // 视角切换下拉框
  function ViewerDropdown({
    currentUserName,
    viewerId: vid,
    onSwitch,
  }: {
    currentUserName: string;
    viewerId: string | null;
    onSwitch: (uid: string | null) => void;
  }) {
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    useEffect(() => {
      fetch("/api/users/list")
        .then((r) => r.json())
        .then(setUsers)
        .catch(() => {});
    }, []);
    return (
      <select
        value={vid ?? ""}
        onChange={(e) => onSwitch(e.target.value || null)}
        className="w-full max-w-full rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50 sm:w-auto"
      >
        <option value="">视角：{currentUserName}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            视角：{u.name}
          </option>
        ))}
      </select>
    );
  }

  const cardBase =
    "min-w-0 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm shadow-lg shadow-black/10";

  const thClass =
    "text-center px-1.5 py-2.5 font-medium text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors";

  function ThSort({ label, sortKey: key }: { label: string; sortKey: SortKey }) {
    return (
      <th
        className={cn(thClass, key === "id" || key === "lv" ? "w-10" : "w-11")}
        onClick={() => handleSort(key)}
      >
        <span className="inline-flex items-center justify-center gap-0.5">
          {label}
          <span className="w-3 text-center">{sortIcon(key)}</span>
        </span>
      </th>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Row 1: noro6 import card + placeholders */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* noro6 import card */}
        <div className={`${cardBase} p-4`}>
          <form onSubmit={onPreview} className="space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="text-sm font-semibold text-white">DATA SYNC / 数据同步</h2>
              </div>
              <ViewerDropdown currentUserName={currentUserName} viewerId={viewerId} onSwitch={switchViewer} />
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

        {/* Placeholder: 锁船标签 */}
        <div
          className={`${cardBase} p-4 flex flex-col items-center justify-center text-center min-h-[140px]`}
        >
          <span className="text-2xl mb-1">🔒</span>
          <p className="text-sm font-medium text-slate-400">锁船标签</p>
        </div>

        {/* Placeholder: 全局攻略 */}
        <div
          className={`${cardBase} p-4 flex flex-col items-center justify-center text-center min-h-[140px]`}
        >
          <span className="text-2xl mb-1">📝</span>
          <p className="text-sm font-medium text-slate-400">全局攻略</p>
        </div>
      </div>

      {/* Row 2: 拥有舰船 (wider) + 拥有装备 (wide) */}
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row">
        {/* 拥有舰船 */}
        <div className={`${cardBase} w-full lg:w-[560px] lg:shrink-0`}>
          <div className="flex flex-col gap-3 border-b border-slate-700/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg">🚢</span>
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
              <span className="text-lg">🔧</span>
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
                      className="text-center px-3 py-2.5 font-medium text-slate-400 w-12 cursor-pointer select-none hover:text-slate-200 transition-colors"
                      onClick={() => handleEquipSort("id")}
                    >
                      <span className="inline-flex items-center justify-center gap-0.5">
                        ID<span className="w-3 text-center">{equipSortIcon("id")}</span>
                      </span>
                    </th>
                    <th
                      className="text-center px-4 py-2.5 font-medium text-slate-400 w-16 cursor-pointer select-none hover:text-slate-200 transition-colors"
                      onClick={() => handleEquipSort("lv")}
                    >
                      <span className="inline-flex items-center justify-center gap-0.5 whitespace-nowrap">
                        改修<span className="w-3 text-center">{equipSortIcon("lv")}</span>
                      </span>
                    </th>
                    <th
                      className="text-center px-4 py-2.5 font-medium text-slate-400 w-16 cursor-pointer select-none hover:text-slate-200 transition-colors"
                      onClick={() => handleEquipSort("count")}
                    >
                      <span className="inline-flex items-center justify-center gap-0.5 whitespace-nowrap">
                        数量<span className="w-3 text-center">{equipSortIcon("count")}</span>
                      </span>
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
                            {item.lv > 0 ? `★+${item.lv}` : "-"}
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
    </div>
  );
}

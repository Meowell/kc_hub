"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import start2 from "@/data/START2.json";
import shipHpData from "@/data/shipHp.json";
import { parseNoro6Data, normalizeNoro6Input } from "@/lib/noro6";

// ---- Master data ----

type ShipMaster = {
  api_id: number;
  api_name: string;
  api_stype: number;
  api_houg: [number, number];
  api_raig: [number, number];
  api_tyku: [number, number];
  api_souk: [number, number];
  api_luck: [number, number];
  api_taik: [number, number];
};

const shipNameById = new Map<number, string>();
const shipBaseById = new Map<number, ShipMaster>();

for (const s of start2.api_mst_ship as ShipMaster[]) {
  shipNameById.set(s.api_id, s.api_name);
  shipBaseById.set(s.api_id, s);
}

// 构建改修链追溯：shipId -> 链最前端的原始船ID
type ChainShip = { api_id: number; api_aftershipid?: string };
const remodelFrom = new Map<number, number>();
for (const s of start2.api_mst_ship as unknown as ChainShip[]) {
  const after = s.api_aftershipid ? Number(s.api_aftershipid) : 0;
  if (after) remodelFrom.set(after, s.api_id);
}
const origByShipId = new Map<number, number>();
function getRemodelRoot(shipId: number): number {
  let cur = shipId;
  const seen = new Set<number>();
  while (true) {
    const from = remodelFrom.get(cur);
    if (!from || seen.has(from)) break;
    seen.add(from);
    cur = from;
  }
  return cur;
}
for (const s of start2.api_mst_ship as unknown as ChainShip[]) {
  origByShipId.set(s.api_id, getRemodelRoot(s.api_id));
}

// 预计算的婚舰HP数据（来自kc-web的master.json）
const shipHpById = new Map(
  (shipHpData as { id: number; hp: number; hp2: number; max_hp: number; orig?: number }[]).map((s) => [s.id, s]),
);

type StypeMaster = { api_id: number; api_name: string };
const stypeNameById = new Map(
  (start2.api_mst_stype as StypeMaster[]).map((t) => [t.api_id, t.api_name]),
);

function baseMin(raw: [number, number] | number): number {
  if (Array.isArray(raw)) return raw[0];
  return raw as number;
}

type EquipMaster = { api_id: number; api_name: string; api_type: number[] };
const equipNameById = new Map<number, string>();
const equipTypeById = new Map<number, number>();
for (const e of start2.api_mst_slotitem as EquipMaster[]) {
  equipNameById.set(e.api_id, e.api_name);
  equipTypeById.set(e.api_id, e.api_type?.[2] ?? 0);
}

type EquipTypeMaster = { api_id: number; api_name: string };
const equipTypeNameById = new Map(
  (start2.api_mst_slotitem_equiptype as EquipTypeMaster[]).map((t) => [t.api_id, t.api_name]),
);

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

export function ShipDataCenter({ initialShipData, currentUserName }: { initialShipData: string; currentUserName: string }) {
  const [shipData, setShipData] = useState(initialShipData);
  const [inputData, setInputData] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  async function switchViewer(uid: string | null) {
    if (!uid) {
      setViewerId(null);
      setShipData(initialShipData);
      return;
    }
    setViewerId(uid);
    try {
      const res = await fetch(`/api/users/ship-data?userId=${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (data.shipData !== undefined) {
        setShipData(data.shipData);
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
        const base = shipBaseById.get(ship.id);
        const mod = ship.st ?? [];
        return {
          rowId: `${ship.id}-${index}`,
          id: ship.id,
          orig: origByShipId.get(ship.id) ?? ship.id,
          name: shipNameById.get(ship.id) ?? `未知舰船 ID ${ship.id}`,
          stype: base ? base.api_stype : 0,
          stypeName: base ? (stypeNameById.get(base.api_stype) ?? "未知") : "未知",
          lv: ship.lv,
          hp:
            (() => {
              if (!base) return 0;
              const hpData = shipHpById.get(ship.id);
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
  }, [shipData]);

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
            name: equipNameById.get(id) ?? `未知装备 ID ${id}`,
            count,
          };
        })
        .sort((a, b) => a.id - b.id || a.lv - b.lv);
    } catch {
      return [];
    }
  }, [shipData]);

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
      const tid = equipTypeById.get(item.id) ?? 0;
      if (tid && !seen.has(tid)) {
        seen.add(tid);
        opts.push({ id: tid, name: equipTypeNameById.get(tid) ?? `类型${tid}` });
      }
    }
    opts.sort((a, b) => a.id - b.id);
    return opts;
  }, [parsedItems]);

  const filteredItems = useMemo(() => {
    let list = parsedItems;
    if (equipTypeFilter !== 0) {
      list = list.filter((item) => (equipTypeById.get(item.id) ?? 0) === equipTypeFilter);
    }
    const kw = equipSearchText.trim().toLowerCase();
    if (kw) {
      list = list.filter((item) => item.name.toLowerCase().includes(kw));
    }
    const dir = equipSortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => (a[equipSortKey] - b[equipSortKey]) * dir);
  }, [parsedItems, equipSortKey, equipSortDir, equipSearchText, equipTypeFilter]);

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!inputData.trim()) {
      setError("请粘贴 noro6 存档数据");
      return;
    }
    let normalized: string;
    try {
      normalized = normalizeNoro6Input(inputData, shipData);
      parseNoro6Data(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "存档格式不正确");
      return;
    }
    setIsSaving(true);
    const res = await fetch("/api/users/ship-data", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipData: normalized }),
    });
    const data = await res.json();
    setIsSaving(false);
    if (!res.ok) {
      setError(data.error ?? "保存失败");
      return;
    }
    setShipData(normalized);
    setInputData("");
    setMessage("舰娘/装备数据已更新 ✅");
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
        className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50"
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
    "rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm shadow-lg shadow-black/10";

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
    <div className="space-y-6">
      {/* Row 1: noro6 import card + placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* noro6 import card */}
        <div className={`${cardBase} p-4`}>
          <form onSubmit={onSubmit} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💾</span>
                <h2 className="text-sm font-semibold text-white">noro6 数据导入</h2>
              </div>
              <ViewerDropdown currentUserName={currentUserName} viewerId={viewerId} onSwitch={switchViewer} />
            </div>
            <Textarea
              className="min-h-20 font-mono text-xs"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder="粘贴舰船/装备/完整外部链接数据"
            />
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
            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving} className="flex-1 text-xs h-8">
                {isSaving ? "⏳ 更新中..." : "💾 更新"}
              </Button>
              <Button
                type="button"
                className="flex-1 text-xs h-8"
                onClick={() => {
                  navigator.clipboard.writeText(inputData).then(
                    () => setMessage("已复制到剪贴板 ✅"),
                  );
                }}
              >
                📋 复制
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
      <div className="flex flex-col lg:flex-row gap-4">
        {/* 拥有舰船 */}
        <div className={`${cardBase} lg:w-[560px]`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚢</span>
              <h2 className="font-semibold text-white">拥有舰船</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {(() => { const ids = new Set(filteredShips.map(s => s.orig)); return ids.size; })()}
                /
                {(() => {
                  const kw = searchText.trim().toLowerCase();
                  const ids = new Set<number>();
                  for (const entry of shipHpData as { id: number }[]) {
                    const b = shipBaseById.get(entry.id);
                    if (stypeFilter !== 0 && (!b || b.api_stype !== stypeFilter)) continue;
                    if (kw) {
                      const n = shipNameById.get(entry.id);
                      if (!n || !n.toLowerCase().includes(kw)) continue;
                    }
                    ids.add(origByShipId.get(entry.id) ?? entry.id);
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
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/30 bg-slate-800/50">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="搜索舰名..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                />
                <select
                  value={stypeFilter}
                  onChange={(e) => setStypeFilter(Number(e.target.value))}
                  className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50"
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
                    className="text-xs text-slate-500 hover:text-slate-300 shrink-0"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm table-fixed">
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔧</span>
              <h2 className="font-semibold text-white">拥有装备</h2>
            </div>
            <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/30 bg-slate-800/50">
                <input
                  type="text"
                  value={equipSearchText}
                  onChange={(e) => setEquipSearchText(e.target.value)}
                  placeholder="搜索装备名..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                />
                <select
                  value={equipTypeFilter}
                  onChange={(e) => setEquipTypeFilter(Number(e.target.value))}
                  className="bg-slate-700 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500/50"
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
                    className="text-xs text-slate-500 hover:text-slate-300 shrink-0"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-5 py-2.5 font-medium text-slate-400">
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
                      <td className="px-5 py-2.5 text-slate-200 font-medium">
                        <span className={item.isGroup ? "" : "pl-4"}>
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

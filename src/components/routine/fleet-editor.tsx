"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardPaste, Download, Inbox, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createFleetParser,
  serializeDeckBuilderFleet,
  type FleetGroupKey,
  type FleetParser,
  type ParsedFleet,
  type ParsedFleetKind,
  type ParsedShip,
} from "@/lib/fleet-parser";
import { createMasterLookup, shipTypeLabels, type MasterLookup } from "@/lib/master-data";
import { parseNoro6Data } from "@/lib/noro6";
import { useMasterData } from "@/lib/use-master-data";

function getShipTypeAbbr(shipId: number, lookup: MasterLookup): string {
  const stype = lookup.shipTypeById.get(shipId);
  return stype ? (shipTypeLabels[stype] ?? "?") : "?";
}

/* ── Fleet / Equipment state types ── */

interface EquipSlot {
  equipId: number | null;
  name: string | null;
  improvement?: number;
  proficiency?: string;
}

interface EditorShip {
  name: string;
  id: number;
  level: number;
  hp: number;
  maxHp: number;
  slotCount: number;
  slotCaps: number[];
  equipment: EquipSlot[];   // length = slotCount + 1 (expansion)
}

interface EditorFleetGroup {
  key: FleetGroupKey;
  name?: string;
  ships: EditorShip[];
}

interface EditorFleet {
  groups: EditorFleetGroup[];
  kind: ParsedFleetKind;
  fleetType: number;
}

interface StockEquip {
  equipId: number;
  name: string;
  typeId: number;
  typeName: string;
  lv: number;
}

const PLANE_TYPES = new Set([
  // 6:艦上戦闘機 7:艦上爆撃機 8:艦上攻撃機 9:艦上偵察機
  6,7,8,9,
  // 10:水上偵察機 11:水上爆撃機
  10,11,
  // 25:オートジャイロ 26:対潜哨戒機
  25,26,
  // 41:大型飛行艇 45:水上戦闘機 47:陸上攻撃機
  41,45,47,
  // 56:噴式戦闘機 57:噴式戦闘爆撃機 58:噴式攻撃機
  56,57,58,
  // 94:艦上偵察機(II)
  94,
]);
function isPlane(equipId: number, lookup: MasterLookup): boolean {
  return PLANE_TYPES.has(lookup.equipTypeById.get(equipId) ?? 0);
}

/* ── Stock loaders ── */

interface StockShip {
  uniqueId: string;
  shipId: number;
  level: number;
  name: string;
  stype: number;
  typeName: string;
  maxHp: number;
  fire: number;
  torpedo: number;
  armor: number;
  luck: number;
  asw: number;
}

function baseMin(raw: unknown): number {
  if (Array.isArray(raw)) return (raw[0] as number) ?? 0;
  if (typeof raw === "number") return raw;
  return 0;
}

function loadStockShips(shipData: string | null, lookup: MasterLookup): StockShip[] {
  if (!shipData) return [];
  try {
    const parsed = parseNoro6Data(shipData);
    const occurrence = new Map<number, number>();
    return parsed.ships.map((s) => {
      const idx = occurrence.get(s.id) ?? 0;
      occurrence.set(s.id, idx + 1);
      const hp = lookup.shipHpById.get(s.id);
      const base = lookup.shipBaseById.get(s.id);
      const mod = s.st ?? [];
      return {
        uniqueId: `${s.id}:${idx}`,
        shipId: s.id,
        level: s.lv,
        name: lookup.shipNameById.get(s.id) ?? `ID:${s.id}`,
        stype: base ? base.api_stype : 0,
        typeName: base ? (lookup.stypeNameById.get(base.api_stype) ?? "?") : "?",
        maxHp: hp?.max_hp ?? hp?.hp ?? 99,
        fire: (base ? baseMin(base.api_houg) : 0) + (mod[0] ?? 0),
        torpedo: (base ? baseMin(base.api_raig) : 0) + (mod[1] ?? 0),
        armor: (base ? baseMin(base.api_souk) : 0) + (mod[3] ?? 0),
        luck: (base ? baseMin(base.api_luck) : 0) + (mod[4] ?? 0),
        asw: mod[6] ?? 0,
      };
    });
  } catch { return []; }
}

function loadStockEquips(shipData: string | null, lookup: MasterLookup, parser: FleetParser): StockEquip[] {
  if (!shipData) return [];
  try {
    const parsed = parseNoro6Data(shipData);
    return parsed.items
      .filter((it) => typeof it.id === "number" && it.id > 0)
      .map((it) => {
        const tid = lookup.equipTypeById.get(it.id) ?? 0;
        return {
          equipId: it.id,
          name: parser.equipNameMap.get(it.id) ?? `装備ID:${it.id}`,
          typeId: tid,
          typeName: lookup.equipTypeNameById.get(tid) ?? "その他",
          lv: it.lv ?? 0,
        };
      });
  } catch { return []; }
}

/* ── Convert parsed DeckBuilder ships to EditorShip with full slots ── */

function normalizeFleet(ships: ParsedShip[], lookup: MasterLookup, parser: FleetParser): EditorShip[] {
  return ships.map((s) => {
    const slotCount = s.slotCount ?? parser.shipSlotCountMap.get(s.id) ?? 4;
    const caps = lookup.shipSlotsById.get(s.id) ?? [];
    const equipment: EquipSlot[] = [];

    // Regular slots (0..slotCount-1)
    for (let si = 0; si < slotCount; si++) {
      const regularEqs = s.equipment.filter((e) => !e.isExpanded);
      const match = regularEqs[si];
      equipment.push({
        equipId: match?.equipId ?? null,
        name: match?.name ?? null,
        improvement: match?.improvement,
        proficiency: match?.proficiency,
      });
    }

    // Expansion slot
    const expEq = s.equipment.find((e) => e.isExpanded);
    equipment.push({
      equipId: expEq?.equipId ?? null,
      name: expEq?.name ?? null,
      improvement: expEq?.improvement,
      proficiency: expEq?.proficiency,
    });

    return {
      name: s.name,
      id: s.id,
      level: s.level,
      hp: s.hp,
      maxHp: s.maxHp,
      slotCount,
      slotCaps: caps,
      equipment,
    };
  });
}

function normalizeParsedFleet(fleet: ParsedFleet, lookup: MasterLookup, parser: FleetParser): EditorFleet {
  return {
    kind: fleet.kind,
    fleetType: fleet.fleetType,
    groups: fleet.groups.map((group) => ({
      key: group.key,
      name: group.name,
      ships: normalizeFleet(group.ships, lookup, parser),
    })),
  };
}

/* ── Sub-components ── */

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.min(100, Math.round((hp / maxHp) * 100));
  const isFull = pct >= 100;
  return (
    <div className="relative h-4 w-full rounded-sm overflow-hidden bg-slate-700/50">
      <div
        className={`h-full transition-all ${isFull ? "bg-emerald-500" : "bg-amber-500"}`}
        style={{ width: `${pct}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white drop-shadow-sm">
        {hp} / {maxHp}
      </span>
    </div>
  );
}

function EquipmentRow({
  slot,
  slotIndex,
  cap,
  isExpanded,
  isPlaneEquip,
  onClick,
  onUnequip,
}: {
  slot: EquipSlot;
  slotIndex: number;
  cap: number | undefined;
  isExpanded: boolean;
  isPlaneEquip: (equipId: number) => boolean;
  onClick?: () => void;
  onUnequip?: () => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`flex justify-between items-center gap-2 py-0.5 border-b border-slate-700/30 last:border-0 group ${
        onClick ? "cursor-pointer hover:bg-slate-700/30 rounded-sm px-0.5 -mx-0.5 transition-colors" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {cap !== undefined && !isExpanded && (
          <span className="text-emerald-400 text-[11px] font-medium w-6 shrink-0 text-right">
            {cap}
          </span>
        )}
        {isExpanded && <span className="w-6 shrink-0" />}
        <span className="shrink-0 w-5 h-5 rounded-sm flex items-center justify-center text-[10px] bg-slate-700/50 text-slate-400">
          {isExpanded ? (
            <span className="text-purple-400 text-xs">+</span>
          ) : slot.name ? (
            "◆"
          ) : (
            <span className="text-slate-600">−</span>
          )}
        </span>
        {slot.name ? (
          <span className="text-slate-300 truncate text-[11px] leading-tight">
            {slot.name}
          </span>
        ) : (
          <span className="text-slate-600 italic text-[11px]">
            {isExpanded ? "打孔位" : `槽位 ${slotIndex + 1}`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {slot.equipId != null && isPlaneEquip(slot.equipId) && (
          <span className="text-[11px] font-bold text-amber-400 w-5">
            {slot.proficiency || ">>"}
          </span>
        )}
        {(slot.equipId != null && isPlaneEquip(slot.equipId)) || slot.improvement !== undefined ? (
          <span className="inline-block w-[2rem] text-left text-cyan-400 text-[10px] font-medium">
            {slot.improvement !== undefined ? `改${slot.improvement < 10 ? `+${slot.improvement}` : "max"}` : ""}
          </span>
        ) : null}
        {slot.name && onUnequip && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnequip(); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-red-400 px-1 transition-all"
            title="卸下装备"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function ShipCard({
  ship,
  onShipClick,
  onEquipClick,
  onUnequipSlot,
  getTypeAbbr,
  isPlaneEquip,
}: {
  ship: EditorShip;
  onShipClick?: () => void;
  onEquipClick?: (slotIndex: number) => void;
  onUnequipSlot?: (slotIndex: number) => void;
  getTypeAbbr: (shipId: number) => string;
  isPlaneEquip: (equipId: number) => boolean;
}) {
  const abbr = getTypeAbbr(ship.id);
  return (
    <div
      onClick={onShipClick}
      data-testid="fleet-ship-card"
      className={`flex min-h-[150px] flex-col gap-4 rounded-xl border bg-slate-800/60 p-4 transition-all sm:flex-row ${
        onShipClick
          ? "cursor-pointer border-slate-700/50 hover:border-blue-500/40 hover:bg-slate-800/80"
          : "border-slate-700/50"
      }`}
    >
      {/* Left: Ship Status (30%) */}
      <div className="flex w-full shrink-0 flex-col gap-1 sm:w-[30%]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded">
            {abbr}
          </span>
          <span className="text-sm font-semibold text-white">{ship.name}</span>
        </div>
        <p className="text-xs text-slate-400">
          Lv.<span className="text-slate-300 font-medium">{ship.level}</span>
        </p>
        <HpBar hp={ship.hp} maxHp={ship.maxHp} />
      </div>

      {/* Right: Equipment List (70%) */}
      <div className="flex min-w-0 w-full flex-col text-xs sm:w-[70%]">
        {ship.equipment.map((eq, i) => {
          const isExp = i === ship.slotCount;
          const cap = i < ship.slotCaps.length ? ship.slotCaps[i] : undefined;
          return (
            <EquipmentRow
              key={i}
              slot={eq}
              slotIndex={i}
              cap={cap}
              isExpanded={isExp}
              isPlaneEquip={isPlaneEquip}
              onClick={onEquipClick ? () => onEquipClick(i) : undefined}
              onUnequip={onUnequipSlot ? () => onUnequipSlot(i) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Ship Picker Modal ── */

function levelColor(level: number): string {
  if (level >= 100) return "text-amber-400";
  if (level >= 80) return "text-green-400";
  if (level >= 50) return "text-blue-400";
  return "text-slate-500";
}

type ShipSortKey = "shipId" | "level" | "fire" | "torpedo" | "armor" | "luck" | "asw";
const shipStatHeaders: { key: ShipSortKey; label: string }[] = [
  { key: "fire", label: "火" },
  { key: "torpedo", label: "雷" },
  { key: "armor", label: "甲" },
  { key: "luck", label: "运" },
  { key: "asw", label: "潜" },
];

function ShipPickerModal({
  stock,
  slotIndex,
  fleetLabel,
  onSelect,
  onClose,
}: {
  stock: StockShip[];
  slotIndex: number;
  fleetLabel?: string;
  onSelect: (ship: StockShip) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [stypeFilter, setStypeFilter] = useState(0);
  const [sortKey, setSortKey] = useState<ShipSortKey>("level");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const stypeOptions = useMemo(() => {
    const seen = new Set<number>();
    return stock
      .filter((s) => { if (seen.has(s.stype)) return false; seen.add(s.stype); return true; })
      .map((s) => ({ id: s.stype, name: s.typeName }))
      .sort((a, b) => a.id - b.id);
  }, [stock]);

  const filtered = useMemo(() => {
    let list = stock;
    if (stypeFilter !== 0) list = list.filter((s) => s.stype === stypeFilter);
    const kw = search.trim().toLowerCase();
    if (kw) list = list.filter((s) => s.name.toLowerCase().includes(kw) || String(s.shipId).includes(kw));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => ((a[sortKey] as number) - (b[sortKey] as number)) * dir);
  }, [stock, stypeFilter, search, sortKey, sortDir]);

  function handleSort(key: ShipSortKey) {
    if (sortKey === key) { setSortDir((d) => (d === "desc" ? "asc" : "desc")); }
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[100dvh] flex-col p-0 sm:max-h-[85dvh] sm:max-w-2xl">
        <DialogHeader className="mb-0 border-b border-slate-700/50 px-5 py-4">
          <DialogTitle>选择舰娘 · {fleetLabel ? `${fleetLabel} · ` : ""}位置 {slotIndex + 1}</DialogTitle>
          <DialogDescription className="sr-only">筛选并选择一艘舰船加入舰队。</DialogDescription>
        </DialogHeader>
        {/* Filter bar */}
        <div className="grid grid-cols-1 gap-2 border-b border-slate-700/30 bg-slate-800/50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索舰名 / ID..."
            className="bg-slate-700" />
          <Select value={stypeFilter} onChange={(e) => setStypeFilter(Number(e.target.value))} className="bg-slate-700">
            <option value={0}>全部舰种</option>
            {stypeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {(stypeFilter !== 0 || search.trim()) && (
            <button type="button" onClick={() => { setStypeFilter(0); setSearch(""); }} className="min-h-11 shrink-0 rounded-md px-3 text-sm text-slate-300 hover:bg-slate-700">清除</button>
          )}
          <span className="text-xs text-slate-500">{filtered.length} 艘</span>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">没有匹配的舰娘</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                <tr className="border-b border-slate-700/50">
                  <th aria-sort={sortKey === "shipId" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-12 px-1.5 text-center font-medium text-slate-400"><button type="button" onClick={() => handleSort("shipId")} className="min-h-11 w-full hover:text-slate-200">ID</button></th>
                  <th aria-sort={sortKey === "level" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-10 px-1.5 text-center font-medium text-slate-400"><button type="button" onClick={() => handleSort("level")} className="min-h-11 w-full hover:text-slate-200">Lv</button></th>
                  <th className="text-left px-2 py-2 font-medium text-slate-400">舰船名</th>
                  {shipStatHeaders.map((h) => (
                    <th key={h.key} aria-sort={sortKey === h.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-10 px-1.5 text-center font-medium text-slate-400"><button type="button" onClick={() => handleSort(h.key)} className="min-h-11 w-full hover:text-slate-200">{h.label}</button></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.uniqueId} className="border-t border-slate-700/30 transition-colors hover:bg-slate-700/40">
                    <td className="px-1.5 py-2 text-center text-slate-500 tabular-nums">{s.shipId}</td>
                    <td className={`px-1.5 py-2 text-center tabular-nums font-semibold ${levelColor(s.level)}`}>{s.level}</td>
                    <td className="max-w-[160px] p-0 text-slate-200 font-medium"><button type="button" onClick={() => onSelect(s)} className="min-h-11 w-full truncate px-2 text-left hover:text-sky-200">{s.name}</button></td>
                    {shipStatHeaders.map((h) => (
                      <td key={h.key} className="px-1.5 py-2 text-center tabular-nums text-slate-300">{s[h.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Equipment Picker Modal ── */

function EquipPickerModal({
  stock,
  onSelect,
  onClose,
}: {
  stock: StockEquip[];
  onSelect: (eq: StockEquip) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(0);

  const typeOptions = useMemo(() => {
    const seen = new Set<number>();
    return stock
      .filter((e) => { if (seen.has(e.typeId)) return false; seen.add(e.typeId); return true; })
      .map((e) => ({ id: e.typeId, name: e.typeName }))
      .sort((a, b) => a.id - b.id);
  }, [stock]);

  const filtered = useMemo(() => {
    let list = stock;
    if (typeFilter !== 0) list = list.filter((e) => e.typeId === typeFilter);
    const kw = search.trim().toLowerCase();
    if (kw) list = list.filter((e) => e.name.toLowerCase().includes(kw) || String(e.equipId).includes(kw));
    return list;
  }, [stock, typeFilter, search]);

  // Group by equipId + lv, show count per row (like data center)
  const displayItems = useMemo(() => {
    const key = (e: StockEquip) => `${e.equipId}:${e.lv}`;
    const groups = new Map<string, { equipId: number; name: string; typeName: string; lv: number; count: number }>();
    for (const e of filtered) {
      const k = key(e);
      const g = groups.get(k);
      if (g) { g.count++; }
      else { groups.set(k, { equipId: e.equipId, name: e.name, typeName: e.typeName, lv: e.lv, count: 1 }); }
    }
    return [...groups.values()].sort((a, b) => a.equipId - b.equipId || b.lv - a.lv);
  }, [filtered]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[100dvh] flex-col p-0 sm:max-h-[85dvh] sm:max-w-xl">
        <DialogHeader className="mb-0 border-b border-slate-700/50 px-5 py-4">
          <DialogTitle>选择装备</DialogTitle>
          <DialogDescription className="sr-only">筛选并选择一件装备。</DialogDescription>
        </DialogHeader>
        {/* Filter bar */}
        <div className="grid grid-cols-1 gap-2 border-b border-slate-700/30 bg-slate-800/50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索装备名..."
            className="bg-slate-700" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(Number(e.target.value))} className="bg-slate-700">
            <option value={0}>全部装备</option>
            {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {(typeFilter !== 0 || search.trim()) && (
            <button type="button" onClick={() => { setTypeFilter(0); setSearch(""); }} className="min-h-11 shrink-0 rounded-md px-3 text-sm text-slate-300 hover:bg-slate-700">清除</button>
          )}
          <span className="text-xs text-slate-500">{displayItems.length} 种</span>
        </div>
        {/* List */}
        <div className="flex-1 overflow-auto">
          {displayItems.length === 0 ? (
            <p className="text-center text-slate-500 py-10 text-sm">没有匹配的装备</p>
          ) : (
            displayItems.map((row, i) => (
              <button key={`${row.equipId}-${row.lv}-${i}`} type="button"
                onClick={() => onSelect({ equipId: row.equipId, name: row.name, typeId: 0, typeName: "", lv: row.lv })}
                className="flex min-h-11 w-full items-center gap-3 border-b border-slate-700/20 px-5 py-2.5 text-left transition-colors hover:bg-slate-700/30">
                <span className="text-sm text-slate-200 flex-1 truncate">{row.name}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{row.typeName}</span>
                {row.lv > 0 && <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-amber-400">改修 +{row.lv}</span>}
                {row.lv === 0 && <span className="text-[11px] text-slate-600 shrink-0 w-10 text-right">-</span>}
                <span className="text-xs text-slate-500 shrink-0 w-6 text-right">{row.count}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main ── */

export function FleetEditor({
  shipData,
  initialFleetData,
  onFleetChange,
  readOnly,
  onBack,
  title,
}: {
  shipData: string | null;
  initialFleetData?: string;
  onFleetChange?: (json: string) => void;
  readOnly?: boolean;
  onBack?: () => void;
  title?: string;
}) {
  const { masterData } = useMasterData();
  const masterLookup = useMemo(() => createMasterLookup(masterData), [masterData]);
  const fleetParser = useMemo(() => createFleetParser(masterData), [masterData]);
  const normalizeFleetForMaster = useCallback(
    (fleet: ParsedFleet) => normalizeParsedFleet(fleet, masterLookup, fleetParser),
    [fleetParser, masterLookup],
  );
  const getTypeAbbr = useCallback(
    (shipId: number) => getShipTypeAbbr(shipId, masterLookup),
    [masterLookup],
  );
  const isPlaneEquip = useCallback(
    (equipId: number) => isPlane(equipId, masterLookup),
    [masterLookup],
  );
  const [rawText, setRawText] = useState(initialFleetData ?? "");
  const [fleet, setFleet] = useState<EditorFleet | null>(() => {
    if (!initialFleetData) return null;
    const result = fleetParser.parseFleetData(initialFleetData);
    return result ? normalizeFleetForMaster(result) : null;
  });
  const [error, setError] = useState("");
  const [pickerShipSlot, setPickerShipSlot] = useState<{ groupIdx: number; shipIdx: number } | null>(null);
  const [equipTarget, setEquipTarget] = useState<{ groupIdx: number; shipIdx: number; slotIdx: number } | null>(null);

  const stockShips = useMemo(() => loadStockShips(shipData, masterLookup), [shipData, masterLookup]);
  const stockEquips = useMemo(
    () => loadStockEquips(shipData, masterLookup, fleetParser),
    [fleetParser, masterLookup, shipData],
  );
  const hasStock = stockShips.length > 0;

  // Reload saved fleet records when the record or runtime master data changes.
  useEffect(() => {
    if (initialFleetData) {
      const result = fleetParser.parseFleetData(initialFleetData);
      setFleet(result ? normalizeFleetForMaster(result) : null);
      setRawText(initialFleetData);
    }
  }, [fleetParser, initialFleetData, normalizeFleetForMaster]);

  // Clear the editor only when switching back to the new-record state.
  useEffect(() => {
    if (!initialFleetData && !readOnly) {
      setFleet(null);
      setRawText("");
    }
  }, [initialFleetData, readOnly]);

  function updateFleet(next: EditorFleet | null) {
    setFleet(next);
    if (onFleetChange && next) {
      onFleetChange(serializeDeckBuilderFleet(next));
    }
  }

  function handlePaste() {
    setError("");
    const result = fleetParser.parseFleetData(rawText);
    if (!result) {
      setError("无法解析数据，请确认是 DeckBuilder JSON 格式");
      updateFleet(null);
      return;
    }
    updateFleet(normalizeFleetForMaster(result));
  }

  function handleSwapShip(stockShip: StockShip) {
    if (pickerShipSlot === null || !fleet) return;
    const { groupIdx, shipIdx } = pickerShipSlot;
    const hp = masterLookup.shipHpById.get(stockShip.shipId);
    const slotCount = fleetParser.shipSlotCountMap.get(stockShip.shipId) ?? 4;
    const caps = masterLookup.shipSlotsById.get(stockShip.shipId) ?? [];
    const equip: EquipSlot[] = [];
    for (let si = 0; si < slotCount; si++) {
      equip.push({ equipId: null, name: null });
    }
    equip.push({ equipId: null, name: null }); // expansion
    const nextShip: EditorShip = {
      name: stockShip.name,
      id: stockShip.shipId,
      level: stockShip.level,
      hp: hp?.max_hp ?? hp?.hp ?? 99,
      maxHp: hp?.max_hp ?? hp?.hp ?? 99,
      slotCount,
      slotCaps: caps,
      equipment: equip,
    };
    const nextGroups = fleet.groups.map((group, index) => {
      if (index !== groupIdx) return group;
      const ships = [...group.ships];
      ships[shipIdx] = nextShip;
      return { ...group, ships };
    });
    updateFleet({ ...fleet, groups: nextGroups });
    setPickerShipSlot(null);
  }

  function handleSetEquip(sel: StockEquip) {
    if (!equipTarget || !fleet) return;
    const { groupIdx, shipIdx, slotIdx } = equipTarget;
    const group = fleet.groups[groupIdx];
    const ships = [...group.ships];
    const ship = { ...ships[shipIdx] };
    const equip = [...ship.equipment];

    if (sel.equipId === 0) {
      // Unequip
      equip[slotIdx] = { equipId: null, name: null };
    } else {
      equip[slotIdx] = {
        equipId: sel.equipId,
        name: sel.name,
        improvement: sel.lv > 0 ? sel.lv : undefined,
      };
    }
    ship.equipment = equip;
    ships[shipIdx] = ship;
    const nextGroups = fleet.groups.map((current, index) => index === groupIdx ? { ...current, ships } : current);
    updateFleet({ ...fleet, groups: nextGroups });
    setEquipTarget(null);
  }

  function handleUnequip(groupIdx: number, shipIdx: number, slotIdx: number) {
    if (!fleet) return;
    const group = fleet.groups[groupIdx];
    const ships = [...group.ships];
    const ship = { ...ships[shipIdx] };
    const equip = [...ship.equipment];
    equip[slotIdx] = { equipId: null, name: null };
    ship.equipment = equip;
    ships[shipIdx] = ship;
    const nextGroups = fleet.groups.map((current, index) => index === groupIdx ? { ...current, ships } : current);
    updateFleet({ ...fleet, groups: nextGroups });
  }

  const canEdit = hasStock && !readOnly;
  const totalShipCount = fleet?.groups.reduce((total, group) => total + group.ships.length, 0) ?? 0;
  const fleetKindLabel = fleet?.kind === "combined"
    ? `联合舰队 · ${fleet.groups.map((group) => group.ships.length).join("+")}艘`
    : fleet?.kind === "strike"
      ? `游击舰队 · ${totalShipCount}艘`
      : fleet
        ? `通常舰队 · ${totalShipCount}艘`
        : null;

  return (
    <div className="space-y-4">
      {/* Paste area - hidden when viewing existing record */}
      {!initialFleetData && (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-4 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardPaste className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs text-slate-500">
            粘贴战斗记录或 DeckBuilder 阵容数据
            {hasStock && (
              <span className="text-emerald-400 ml-1">
                · 已加载 {stockShips.length} 舰娘 · {stockEquips.length} 装备
              </span>
            )}
          </span>
        </div>
        <Textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setError(""); }}
          placeholder='粘贴 DeckBuilder 或 战斗记录 JSON'
          rows={4}
          className="text-xs font-mono"
        />
        <div className="flex items-center justify-between mt-2">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button type="button" onClick={handlePaste} disabled={!rawText.trim()} className="ml-auto text-sm">
            <Download className="h-4 w-4" aria-hidden="true" />读取阵容
          </Button>
        </div>
      </div>
      )}

      {/* Fleet display */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-5 shadow-lg shadow-black/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-200">
            <span>{title || "主力艦隊"}</span>
            {fleetKindLabel && (
              <span data-testid="fleet-kind" className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-300">
                {fleetKindLabel}
              </span>
            )}
            {!hasStock && !initialFleetData && (
              <span className="text-xs text-amber-400 font-normal">
                （未上传舰船数据，无法换船/换装）
              </span>
            )}
            {readOnly && (
              <span className="text-xs text-slate-500 font-normal">（只读）</span>
            )}
          </h3>
          {onBack && (
            <button type="button" onClick={onBack}
              className="text-xs text-slate-400 hover:text-white border border-slate-600/50 rounded-lg px-3 py-1.5 hover:bg-slate-700/50 transition-colors">
              ← 返回列表
            </button>
          )}
        </div>

        {fleet && totalShipCount > 0 ? (
          <div className="space-y-6">
            {fleet.groups.map((group, groupIdx) => (
              <section key={group.key} data-testid={`fleet-group-${group.key}`} className={groupIdx > 0 ? "border-t border-slate-700/50 pt-6" : undefined}>
                {fleet.kind === "combined" && (
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-300">
                      {group.key === "f1" ? "第一舰队" : "第二舰队"}
                    </h4>
                    <span className="text-xs text-slate-500">{group.ships.length} / 6 艘</span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                  {group.ships.map((ship, shipIdx) => (
                    <ShipCard
                      key={`${group.key}-${shipIdx}`}
                      ship={ship}
                      getTypeAbbr={getTypeAbbr}
                      isPlaneEquip={isPlaneEquip}
                      onShipClick={canEdit ? () => setPickerShipSlot({ groupIdx, shipIdx }) : undefined}
                      onEquipClick={canEdit ? (slotIdx) => setEquipTarget({ groupIdx, shipIdx, slotIdx }) : undefined}
                      onUnequipSlot={canEdit ? (slotIdx) => handleUnequip(groupIdx, shipIdx, slotIdx) : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/40 py-12 text-center">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="text-sm text-slate-500">在上方粘贴 DeckBuilder 数据以加载阵容</p>
          </div>
        )}
      </div>

      {/* Ship Picker Modal */}
      {pickerShipSlot !== null && (
        <ShipPickerModal
          stock={stockShips}
          slotIndex={pickerShipSlot.shipIdx}
          fleetLabel={fleet?.kind === "combined" ? (fleet.groups[pickerShipSlot.groupIdx]?.key === "f1" ? "第一舰队" : "第二舰队") : undefined}
          onSelect={handleSwapShip}
          onClose={() => setPickerShipSlot(null)}
        />
      )}

      {/* Equipment Picker Modal */}
      {equipTarget !== null && (
        <EquipPickerModal
          stock={stockEquips}
          onSelect={handleSetEquip}
          onClose={() => setEquipTarget(null)}
        />
      )}
    </div>
  );
}

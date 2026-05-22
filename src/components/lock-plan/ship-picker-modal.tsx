"use client";

import { useMemo, useState, useDeferredValue } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { shipTypeLabels } from "@/lib/lock-plan-helpers";
import { type ShipStock } from "@/lib/noro6";
import { cn } from "@/lib/utils";

export type ShipLockInfo = {
  uniqueId: string;
  tagColorClass: string;
  tagName: string;
};

type ShipPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ships: ShipStock[];
  shipLocks: Map<string, ShipLockInfo>; // uniqueId -> { tagColorClass, tagName }
  getShipName: (shipId: number) => string;
  getShipType: (shipId: number) => string;
  getShipTypeId: (shipId: number) => string;
  onSelectShip: (ship: ShipStock) => void;
};

function levelColor(level: number): string {
  if (level >= 100) return "text-amber-700";
  if (level >= 80) return "text-green-700";
  if (level >= 50) return "text-blue-700";
  return "text-slate-600";
}

export function ShipPickerModal({
  open,
  onOpenChange,
  ships,
  shipLocks,
  getShipName,
  getShipType,
  getShipTypeId,
  onSelectShip,
}: ShipPickerModalProps) {
  const [query, setQuery] = useState("");
  const [shipType, setShipType] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const filteredShips = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return ships
      .filter((ship) => {
        const name = getShipName(ship.shipId);
        const matchesQuery =
          !q || name.toLowerCase().includes(q) || String(ship.shipId).includes(q);
        const matchesType =
          shipType === "all" ||
          getShipTypeId(ship.shipId) === shipType;
        return matchesQuery && matchesType;
      })
      .sort((a, b) => b.level - a.level);
  }, [ships, deferredQuery, shipType, getShipName, getShipTypeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>选择舰娘</DialogTitle>
          <DialogDescription>
            点击舰娘卡片即可完成分配。已有锁船的卡片会显示对应标签颜色。
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 group">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索舰名或 ID"
              className="w-full pr-16"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                清除
              </button>
            )}
          </div>
          <Select
            value={shipType}
            onChange={(e) => setShipType(e.target.value)}
            className="w-40 bg-white text-slate-800 border-slate-300"
          >
            <option value="all">全部舰种</option>
            {Object.entries(shipTypeLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {/* Ship grid */}
        {filteredShips.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {ships.length === 0 ? "该提督暂无舰船数据" : "没有匹配的舰船"}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-[60vh] overflow-auto pr-1">
            {filteredShips.map((ship) => {
              const lock = shipLocks.get(ship.uniqueId);
              return (
                <button
                  key={ship.uniqueId}
                  type="button"
                  onClick={() => onSelectShip(ship)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:shadow",
                    lock
                      ? `${lock.tagColorClass} border-transparent`
                      : "bg-white hover:bg-slate-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
                      <span className={cn("font-semibold", levelColor(ship.level))}>Lv{ship.level}</span>
                      <span className="text-slate-700">{getShipType(ship.shipId)}</span>
                      <span className="text-slate-700">ID {ship.shipId}</span>
                    </div>
                    <p className="truncate text-sm font-medium mt-0.5 text-slate-800">
                      {getShipName(ship.shipId)}
                    </p>
                    {/* Stats row */}
                    <div className="mt-1 flex gap-1.5 text-[10px] text-slate-500">
                      <span>火{ship.firepower}</span>
                      <span>雷{ship.torpedo}</span>
                      <span>空{ship.antiAir}</span>
                      <span>甲{ship.armor}</span>
                      <span>运{ship.luck}</span>
                    </div>
                  </div>
                  {lock && (
                    <span className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {lock.tagName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



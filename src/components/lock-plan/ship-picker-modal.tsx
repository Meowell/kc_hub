"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { BadgePercent } from "lucide-react";

import { BonusGroupDetails } from "@/components/lock-plan/bonus-group-details";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getShipBonusMatch,
  type ActivityBonusGroup,
  type ShipBonusMatch,
} from "@/lib/activity-bonus";
import {
  getLockTagColorClassName,
  getLockTagColorStyle,
  isCustomLockTagColor,
} from "@/lib/lock-tag-colors";
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
  bonusGroups?: ActivityBonusGroup[];
  getShipName: (shipId: number) => string;
  getShipType: (shipId: number) => string;
  getShipTypeId: (shipId: number) => string;
  getShipOriginalId?: (shipId: number) => number;
  onSelectShip: (ship: ShipStock) => void;
};

type BonusFilter = "all" | "named" | "none";

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
  bonusGroups = [],
  getShipName,
  getShipType,
  getShipTypeId,
  getShipOriginalId,
  onSelectShip,
}: ShipPickerModalProps) {
  const [query, setQuery] = useState("");
  const [shipType, setShipType] = useState("all");
  const [bonusFilter, setBonusFilter] = useState<BonusFilter>("all");
  const [bonusDetail, setBonusDetail] = useState<{
    shipName: string;
    match: ShipBonusMatch;
  } | null>(null);
  const deferredQuery = useDeferredValue(query);

  const filteredShips = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return ships
      .filter((ship) => {
        const name = getShipName(ship.shipId);
        const shipTypeId = Number(getShipTypeId(ship.shipId)) || undefined;
        const bonusMatch = getShipBonusMatch(
          bonusGroups,
          ship.shipId,
          shipTypeId,
          getShipOriginalId?.(ship.shipId) ?? ship.shipId,
        );
        const matchesQuery =
          !q || name.toLowerCase().includes(q) || String(ship.shipId).includes(q);
        const matchesType =
          shipType === "all" ||
          getShipTypeId(ship.shipId) === shipType;
        const matchesBonus =
          bonusFilter === "all" ||
          (bonusFilter === "named" && bonusMatch.hasNamedBonus) ||
          (bonusFilter === "none" && !bonusMatch.hasNamedBonus);

        return matchesQuery && matchesType && matchesBonus;
      })
      .sort((a, b) => b.level - a.level);
  }, [ships, deferredQuery, shipType, bonusFilter, bonusGroups, getShipName, getShipTypeId, getShipOriginalId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setBonusDetail(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:w-[calc(100vw-3rem)] sm:!max-w-[1320px]">
        <DialogHeader>
          <DialogTitle>选择舰娘</DialogTitle>
          <DialogDescription>
            点击舰娘卡片即可完成分配。已有锁船的卡片会显示对应标签颜色。
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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
            className="sm:w-40 bg-white text-slate-800 border-slate-300"
          >
            <option value="all">全部舰种</option>
            {Object.entries(shipTypeLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={bonusFilter}
            onChange={(e) => setBonusFilter(e.target.value as BonusFilter)}
            className="sm:w-40 bg-white text-slate-800 border-slate-300"
          >
            <option value="all">全部舰娘</option>
            <option value="named">特定舰倍卡</option>
            <option value="none">无特定舰倍卡</option>
          </Select>
        </div>

        {/* Ship grid */}
        {filteredShips.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {ships.length === 0 ? "该提督暂无舰船数据" : "没有匹配的舰船"}
          </p>
        ) : (
          <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredShips.map((ship) => {
              const lock = shipLocks.get(ship.uniqueId);
              const hasCustomLockColor = isCustomLockTagColor(lock?.tagColorClass);
              const shipTypeId = Number(getShipTypeId(ship.shipId)) || undefined;
              const bonusMatch = getShipBonusMatch(
                bonusGroups,
                ship.shipId,
                shipTypeId,
                getShipOriginalId?.(ship.shipId) ?? ship.shipId,
              );
              const shipName = getShipName(ship.shipId);
              return (
                <div
                  key={ship.uniqueId}
                  onClick={() => onSelectShip(ship)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectShip(ship);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "relative flex min-h-[96px] items-center rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:shadow focus:outline-none focus:ring-2 focus:ring-primary/50",
                    lock
                      ? cn("border-transparent", getLockTagColorClassName(lock.tagColorClass), !hasCustomLockColor && "text-slate-800")
                      : "bg-white hover:bg-slate-50",
                  )}
                  style={lock ? getLockTagColorStyle(lock.tagColorClass) : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className={cn("flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px]", hasCustomLockColor ? "text-inherit" : "text-slate-700")}>
                        <span className={cn("font-semibold", levelColor(ship.level))}>Lv{ship.level}</span>
                        <span className={hasCustomLockColor ? "text-inherit" : "text-slate-700"}>{getShipType(ship.shipId)}</span>
                        <span className={hasCustomLockColor ? "text-inherit" : "text-slate-700"}>ID {ship.shipId}</span>
                      </div>
                      {bonusMatch.hasAnyBonus && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setBonusDetail({ shipName, match: bonusMatch });
                          }}
                          className={cn(
                            "flex max-w-[58%] shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            bonusMatch.hasNamedBonus
                              ? "bg-red-500/10 text-red-700 ring-1 ring-red-500/20"
                              : "bg-slate-200/80 text-slate-600",
                          )}
                          title="查看舰船倍卡"
                        >
                          <BadgePercent className="h-3 w-3 shrink-0" />
                          <span className="truncate">{bonusMatch.groupLabel}</span>
                          <span className="shrink-0">{bonusMatch.multiplierLabel}</span>
                        </button>
                      )}
                    </div>
                    <p className={cn(
                      "truncate text-sm font-medium mt-0.5",
                      hasCustomLockColor ? "text-inherit" : "text-slate-800",
                      bonusMatch.hasNamedBonus && "font-bold text-red-600",
                    )}>
                      {shipName}
                    </p>
                    {/* Stats row */}
                    <div className={cn("mt-2 flex gap-2 text-[11px]", lock && "pr-24", hasCustomLockColor ? "text-inherit opacity-80" : "text-slate-500")}>
                      <span>火{ship.firepower}</span>
                      <span>雷{ship.torpedo}</span>
                      <span>空{ship.antiAir}</span>
                      <span>甲{ship.armor}</span>
                      <span>运{ship.luck}</span>
                    </div>
                  </div>
                  {lock && (
                    <span className="absolute bottom-2 right-2 shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {lock.tagName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Dialog
          open={!!bonusDetail}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setBonusDetail(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{bonusDetail?.shipName ?? ""} 倍卡详情</DialogTitle>
              <DialogDescription>
                仅舰种通用命中的倍卡不会触发红名。
              </DialogDescription>
            </DialogHeader>
            <BonusGroupDetails groups={bonusDetail?.match.groups ?? []} getShipName={getShipName} />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}



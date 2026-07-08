"use client";

import { shipTypeLabels } from "@/lib/master-data";
import {
  countNamedBonusShips,
  formatMultiplier,
  type ActivityBonusGroup,
} from "@/lib/activity-bonus";

type BonusGroupDetailsProps = {
  groups: ActivityBonusGroup[];
  getShipName?: (shipId: number) => string;
  emptyText?: string;
};

export function BonusGroupDetails({
  groups,
  getShipName,
  emptyText = "暂无倍卡组",
}: BonusGroupDetailsProps) {
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="rounded-md border border-border-base bg-slate-950/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                {group.map && (
                  <span className="terminal-label rounded-sm border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] text-sky-200">
                    {group.map}
                  </span>
                )}
              </div>
              {group.description && (
                <p className="mt-1 text-xs text-slate-500">{group.description}</p>
              )}
            </div>
            <div className="terminal-label shrink-0 text-[10px] text-slate-500">
              {countNamedBonusShips([group])} ships / {group.shipTypeIds.length} types
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {group.points.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border-base px-2 py-2 text-xs text-slate-500">
                未填写点位倍率
              </div>
            ) : (
              group.points.map((point) => (
                <div key={`${group.id}-${point.code}-${point.multiplier}`} className="rounded-sm border border-slate-700/70 bg-slate-900/70 px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {point.code}{point.label ? ` / ${point.label}` : ""}
                    </span>
                    <span className="text-xs font-bold text-amber-200">{formatMultiplier(point.multiplier)}</span>
                  </div>
                  {point.note && <p className="mt-1 text-[11px] text-slate-500">{point.note}</p>}
                </div>
              ))
            )}
          </div>

          {(group.shipIds.length > 0 || group.shipTypeIds.length > 0) && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {group.shipIds.length > 0 && (
                <div>
                  <p className="terminal-label mb-1 text-[10px] text-slate-500">NAMED SHIPS</p>
                  <div className="flex max-h-24 flex-wrap gap-1 overflow-auto pr-1">
                    {group.shipIds.map((shipId) => (
                      <span key={shipId} className="rounded-sm bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-200">
                        {getShipName ? getShipName(shipId) : shipId} <span className="text-red-200/55">#{shipId}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {group.shipTypeIds.length > 0 && (
                <div>
                  <p className="terminal-label mb-1 text-[10px] text-slate-500">TYPE BONUS</p>
                  <div className="flex flex-wrap gap-1">
                    {group.shipTypeIds.map((typeId) => (
                      <span key={typeId} className="rounded-sm bg-slate-700/45 px-1.5 py-0.5 text-[11px] text-slate-200">
                        {shipTypeLabels[typeId] ?? `Type ${typeId}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

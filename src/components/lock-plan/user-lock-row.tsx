"use client";

import { type ShipStock } from "@/lib/noro6";
import { type LockAssignment } from "@/lib/lock-plan-helpers";
import { TagLockColumn } from "@/components/lock-plan/tag-lock-column";
import { Badge } from "@/components/ui/badge";

type TagInfo = { id: string; name: string; colorClass: string };
type PlanInfo = { planId: string; tagId: string; assignedData: string; note: string | null; updatedAt?: string };

type UserLockRowProps = {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  tags: TagInfo[];
  plans: PlanInfo[];
  ships: ShipStock[];
  hasShipData: boolean;
  getShipName: (shipId: number) => string;
  getShipType: (shipId: number) => string;
  onCellClick: (userId: string, tagId: string, rowIndex: number) => void;
  onRemoveShip: (userId: string, tagId: string, uniqueId: string) => void;
  onReorder?: (userId: string, tagId: string, newAssignments: (LockAssignment | null)[]) => void;
  onDropShip?: (userId: string, targetTagId: string, uniqueId: string, shipId: number, sourceTagId: string, targetIndex: number) => void;
  readOnly?: boolean;
};

export function UserLockRow({
  userId, userName, avatarUrl, tags, plans, ships, hasShipData,
  getShipName, getShipType,
  onCellClick, onRemoveShip, onReorder, onDropShip, readOnly = false,
}: UserLockRowProps) {
  const planByTagId = new Map(plans.map((p) => [p.tagId, p]));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-start gap-4">
        <div className="sticky left-0 z-20 w-[180px] shrink-0 border border-border-base bg-bg-panel/95 p-3 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-md object-cover ring-1 ring-blue-500/30" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-500/30 bg-blue-600/20 text-sm font-bold text-blue-100">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-white">{userName}</h3>
              <p className="terminal-label mt-0.5 text-[10px] text-slate-500">{hasShipData ? "DATA READY" : "NO DATA"}</p>
            </div>
          </div>
          {readOnly && (
            <Badge variant="secondary" className="mt-3 text-slate-400 bg-slate-700/30 border-slate-600/30">
              只读
            </Badge>
          )}
          {!hasShipData && (
            <Badge variant="secondary" className="mt-3 text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
              未导入存档
            </Badge>
          )}
        </div>

        {hasShipData ? (
          <div className="flex gap-4">
          {tags.map((tag) => {
            const plan = planByTagId.get(tag.id);
            return (
              <TagLockColumn
                key={tag.id}
                tagId={tag.id}
                tagName={tag.name}
                tagColorClass={tag.colorClass}
                assignedData={plan?.assignedData ?? "[]"}
                ships={ships}
                userId={userId}
                getShipName={getShipName}
                getShipType={getShipType}
                onCellClick={(tId, rowIdx) => onCellClick(userName, tId, rowIdx)}
                onRemoveShip={(tId, uId) => onRemoveShip(userName, tId, uId)}
                onReorder={(tId, newAssignments) => onReorder?.(userId, tId, newAssignments)}
                onDropShip={(tId, uId, sId, srcTag, idx) => onDropShip?.(userId, tId, uId, sId, srcTag, idx)}
                readOnly={readOnly}
              />
            );
          })}
          </div>
        ) : (
          <div className="flex min-h-24 w-[520px] items-center border border-dashed border-border-base bg-slate-950/20 px-4 text-sm text-slate-500">
            该提督尚未导入 noro6 舰船数据
          </div>
        )}
      </div>
    </div>
  );
}

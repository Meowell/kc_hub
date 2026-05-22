"use client";

import { type ShipStock } from "@/lib/noro6";
import { type LockAssignment } from "@/lib/lock-plan-helpers";
import { TagLockColumn } from "@/components/lock-plan/tag-lock-column";
import { Badge } from "@/components/ui/badge";

type TagInfo = { id: string; name: string; colorClass: string };
type PlanInfo = { planId: string; tagId: string; assignedData: string; note: string | null };

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
};

export function UserLockRow({
  userId, userName, avatarUrl, tags, plans, ships, hasShipData,
  getShipName, getShipType,
  onCellClick, onRemoveShip, onReorder, onDropShip,
}: UserLockRowProps) {
  const planByTagId = new Map(plans.map((p) => [p.tagId, p]));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover ring-2 ring-blue-500/30" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-2 ring-blue-500/30">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <h3 className="text-base font-bold text-white">{userName}</h3>
        {!hasShipData && (
          <Badge variant="secondary" className="text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
            未导入存档
          </Badge>
        )}
      </div>

      {hasShipData ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
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
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 pl-11">该提督尚未导入 noro6 舰船数据</p>
      )}
    </div>
  );
}

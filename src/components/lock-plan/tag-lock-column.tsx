"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { BadgePercent } from "lucide-react";

import { BonusGroupDetails } from "@/components/lock-plan/bonus-group-details";
import { ShipCell } from "@/components/lock-plan/ship-cell";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  summarizeBonusGroupNames,
  summarizeBonusMultipliers,
  type ActivityBonusGroup,
} from "@/lib/activity-bonus";
import {
  getLockTagColorClassName,
  getLockTagColorStyle,
  isCustomLockTagColor,
} from "@/lib/lock-tag-colors";
import { parseAssignments, type LockAssignment } from "@/lib/lock-plan-helpers";
import { type ShipStock } from "@/lib/noro6";
import { cn } from "@/lib/utils";

type TagLockColumnProps = {
  tagId: string;
  tagName: string;
  tagColorClass: string;
  assignedData: string;
  ships: ShipStock[];
  userId: string;
  getShipName: (shipId: number) => string;
  getShipType: (shipId: number) => string;
  bonusGroups?: ActivityBonusGroup[];
  onCellClick: (tagId: string, rowIndex: number) => void;
  onRemoveShip: (tagId: string, uniqueId: string) => void;
  onReorder?: (tagId: string, newAssignments: (LockAssignment | null)[]) => void;
  onDropShip?: (targetTagId: string, uniqueId: string, shipId: number, sourceTagId: string, targetIndex: number) => void;
  readOnly?: boolean;
};

const MAX_COLS = 3;
const ROWS_PER_COL = 6;
const MAX_SLOTS = MAX_COLS * ROWS_PER_COL;

type DragPayload = {
  uniqueId: string;
  shipId: number;
  sourceTagId: string;
  sourceUserId: string;
};

const STORAGE_PREFIX = "kc-lock-slots-";

function loadSlotCount(tagId: string, minCount: number): number {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + tagId);
    if (stored) {
      const val = parseInt(stored, 10);
      if (val >= minCount && val <= MAX_SLOTS) return val;
    }
  } catch { /* ignore */ }
  return minCount;
}

function saveSlotCount(tagId: string, count: number) {
  try { localStorage.setItem(STORAGE_PREFIX + tagId, String(count)); } catch { /* ignore */ }
}

export function TagLockColumn({
  tagId, tagName, tagColorClass, assignedData, ships, userId,
  getShipName, getShipType, bonusGroups = [],
  onCellClick, onRemoveShip, onReorder, onDropShip, readOnly = false,
}: TagLockColumnProps) {
  const assignments = useMemo(() => parseAssignments(assignedData), [assignedData]);

  const filledCount = useMemo(
    () => assignments.filter((a): a is LockAssignment => a !== null).length,
    [assignments],
  );

  // Server-safe default: no localStorage access during SSR
  const defaultSlotCount = Math.max(1, Math.min(filledCount, MAX_SLOTS));

  const [slotCount, setSlotCount] = useState(defaultSlotCount);
  const [slotInitialized, setSlotInitialized] = useState(false);

  // Hydrate slotCount from localStorage on client mount (avoids hydration mismatch)
  useEffect(() => {
    setSlotInitialized(true);
    const saved = loadSlotCount(tagId, defaultSlotCount);
    if (saved !== slotCount) {
      setSlotCount(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist slotCount to localStorage (skip during initial hydration)
  useEffect(() => {
    if (slotInitialized) {
      saveSlotCount(tagId, slotCount);
    }
  }, [tagId, slotCount, slotInitialized]);

  // Auto-expand slotCount when filled count exceeds current slots
  useEffect(() => {
    if (filledCount > slotCount) {
      setSlotCount(filledCount);
    }
  }, [filledCount, slotCount]);

  // Always show enough slots: at least slotCount, at least filledCount
  const visibleCount = Math.min(Math.max(slotCount, filledCount), MAX_SLOTS);

  // Column-level drag-over highlight (not per-cell, to avoid re-renders during drag)
  const [columnDragOver, setColumnDragOver] = useState(false);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const hasBonusGroups = bonusGroups.length > 0;

  const shipByUniqueId = useMemo(() => {
    const map = new Map<string, ShipStock>();
    for (const s of ships) map.set(s.uniqueId, s);
    return map;
  }, [ships]);

  const slots: Array<{ uniqueId: string; shipId: number } | null> = [
    ...assignments.slice(0, visibleCount),
    ...Array.from({ length: Math.max(0, visibleCount - assignments.length) }, () => null),
  ];

  // Dynamic column count based on visible slots
  const numCols = Math.ceil(visibleCount / ROWS_PER_COL);

  const columns: Array<Array<{ uniqueId: string; shipId: number } | null>> = [];
  for (let col = 0; col < numCols; col++) {
    columns.push(slots.slice(col * ROWS_PER_COL, (col + 1) * ROWS_PER_COL));
  }

  // ---- Drag handlers ----

  const handleDragStart = useCallback((e: React.DragEvent, assignment: { uniqueId: string; shipId: number }) => {
    if (readOnly) return;
    const payload: DragPayload = {
      uniqueId: assignment.uniqueId,
      shipId: assignment.shipId,
      sourceTagId: tagId,
      sourceUserId: userId,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }, [readOnly, tagId, userId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, [readOnly]);

  // Column-level drag enter/leave for whole-column drop target
  const handleColumnDragEnter = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setColumnDragOver(true);
  }, [readOnly]);

  const handleColumnDragLeave = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    if (!target.contains(e.relatedTarget as Node)) {
      setColumnDragOver(false);
    }
  }, []);

  // Process drag payload — insert at exact dropIndex, allowing gaps
  function processDrop(dragData: DragPayload, dropIndex: number) {
    if (dragData.sourceTagId === tagId) {
      const currentSlot = slots[dropIndex];
      if (currentSlot?.uniqueId === dragData.uniqueId) return;
    }

    if (dragData.sourceTagId === tagId) {
      // Same tag: reorder — insert at exact dropIndex, preserving gaps
      const newArr: (LockAssignment | null)[] = assignments.map((a) =>
        (a && a.uniqueId === dragData.uniqueId) ? null : a,
      );
      // Extend array to reach dropIndex
      while (newArr.length <= dropIndex) newArr.push(null);
      newArr[dropIndex] = { uniqueId: dragData.uniqueId, shipId: dragData.shipId };
      // Trim trailing nulls
      while (newArr.length > 0 && newArr[newArr.length - 1] === null) {
        newArr.pop();
      }
      onReorder?.(tagId, newArr);
    } else {
      // Cross-tag: move ship
      onDropShip?.(tagId, dragData.uniqueId, dragData.shipId, dragData.sourceTagId, dropIndex);
    }
  }

  // Drop on a specific cell
  const handleCellDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setColumnDragOver(false);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;

    try {
      const dragData: DragPayload = JSON.parse(raw);
      processDrop(dragData, dropIndex);
    } catch { /* invalid data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, slots, tagId, onReorder, onDropShip]);

  // Drop on the column body (not a specific cell) → place at first available slot
  const handleColumnDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setColumnDragOver(false);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;

    try {
      const dragData: DragPayload = JSON.parse(raw);
      // First empty slot = first null in the compacted array
      const compacted = assignments.filter((a): a is LockAssignment => a !== null);
      // Remove the dragged ship from compacted view for source-tag calculation
      const withoutDragged = compacted.filter(a => a.uniqueId !== dragData.uniqueId);
      const targetIndex = withoutDragged.length;
      processDrop(dragData, targetIndex);
    } catch { /* invalid data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, tagId, onReorder, onDropShip]);

  return (
    <div
      className={cn(
        "flex w-fit flex-col rounded-xl border border-slate-700/50 bg-slate-800/60 p-3",
        columnDragOver && "ring-2 ring-blue-400/50",
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleColumnDragEnter}
      onDragLeave={handleColumnDragLeave}
      onDrop={readOnly ? undefined : handleColumnDrop}
    >
      <div
        className={cn(
          "sticky top-0 z-10 mb-2 rounded-sm px-2 py-1 shadow-sm",
          getLockTagColorClassName(tagColorClass),
          !isCustomLockTagColor(tagColorClass) && "text-slate-800",
        )}
        style={getLockTagColorStyle(tagColorClass)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-inherit whitespace-nowrap">{tagName}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={visibleCount <= 1}
              onClick={() => setSlotCount((prev) => Math.max(1, prev - 1))}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition text-inherit",
                visibleCount <= 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-black/10",
              )}
            >
              −
            </button>
            <Badge variant="accent" className="text-xs px-1 min-w-[2.25rem] justify-center bg-white/60 text-slate-700 border-white/30">
              {filledCount}/{slotCount}
            </Badge>
            <button
              type="button"
              disabled={visibleCount >= MAX_SLOTS}
              onClick={() => setSlotCount((prev) => Math.min(MAX_SLOTS, prev + 1))}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition text-inherit",
                visibleCount >= MAX_SLOTS
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-black/10",
              )}
            >
              +
            </button>
          </div>
        </div>
        {hasBonusGroups && (
          <button
            type="button"
            onClick={() => setBonusDialogOpen(true)}
            className="mt-1 flex w-full items-center justify-between gap-1 rounded bg-white/55 px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-700 transition hover:bg-white/75"
            title="查看贴条倍卡"
          >
            <span className="flex min-w-0 items-center gap-1">
              <BadgePercent className="h-3 w-3 shrink-0" />
              <span className="truncate">{summarizeBonusGroupNames(bonusGroups)}</span>
            </span>
            <span className="shrink-0">{summarizeBonusMultipliers(bonusGroups)}</span>
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {columns.map((colSlots, colIndex) => (
          <div key={colIndex} className="flex w-[150px] flex-col gap-1.5">
            {colSlots.map((assignment, rowIndex) => {
              const globalIndex = colIndex * ROWS_PER_COL + rowIndex;
              return (
<ShipCell
  key={assignment?.uniqueId ?? `empty-${colIndex}-${rowIndex}`}
  assignment={assignment}
  ship={assignment ? shipByUniqueId.get(assignment.uniqueId) : null}
  tagColorClass={tagColorClass}
  getShipName={getShipName}
  getShipType={getShipType}
  onClick={() => onCellClick(tagId, globalIndex)}
  onRemove={() => { if (assignment) onRemoveShip(tagId, assignment.uniqueId); }}
  onDragStart={!readOnly && assignment ? ((e) => handleDragStart(e, assignment)) : undefined}
  onDrop={readOnly ? undefined : (e) => handleCellDrop(e, globalIndex)}
  onDragOver={readOnly ? undefined : handleDragOver}
  columnDragOver={columnDragOver}
  readOnly={readOnly}
/>
              );
            })}
          </div>
        ))}
      </div>
      <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tagName} 倍卡详情</DialogTitle>
          </DialogHeader>
          <BonusGroupDetails groups={bonusGroups} getShipName={getShipName} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

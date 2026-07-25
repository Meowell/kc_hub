"use client";

import { X } from "lucide-react";
import { type ShipStock } from "@/lib/noro6";
import { getLockTagColorClassName, getLockTagStripStyle } from "@/lib/lock-tag-colors";
import { type CopySlotHint } from "@/lib/lock-plan-helpers";
import { cn } from "@/lib/utils";

type ShipCellProps = {
  assignment?: { uniqueId: string; shipId: number } | null;
  copyHint?: CopySlotHint | null;
  ship?: ShipStock | null;
  tagColorClass: string;
  getShipName: (shipId: number) => string;
  getShipType: (shipId: number) => string;
  onClick: () => void;
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  columnDragOver?: boolean;
  readOnly?: boolean;
};

function levelColor(level: number): string {
  if (level >= 100) return "text-amber-400";
  if (level >= 80) return "text-green-400";
  if (level >= 50) return "text-blue-400";
  return "text-slate-500";
}

export function ShipCell({
  assignment, copyHint, ship, tagColorClass, getShipName, getShipType, onClick, onRemove,
  onDragStart, onDrop, onDragOver, columnDragOver, readOnly = false,
}: ShipCellProps) {
  if (!assignment && copyHint) {
    const hintedShipName = getShipName(copyHint.shipId);
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={readOnly ? undefined : onClick}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
        title={`缺少 ${hintedShipName}，点击选择替代舰船`}
        aria-label={`缺少 ${hintedShipName}，点击选择替代舰船`}
        className={cn(
          "relative flex min-h-[2.8rem] w-full items-center overflow-hidden rounded-lg border border-dashed border-sky-400/55 bg-sky-500/10 px-2 py-1 text-left",
          "transition hover:border-sky-300 hover:bg-sky-500/15 focus:outline-none focus:ring-2 focus:ring-sky-300/60",
          readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          !readOnly && columnDragOver && "border-blue-300 bg-blue-500/15",
        )}
      >
        <span className="absolute left-2 top-1 text-[10px] font-semibold leading-none text-sky-200/70">
          Lv{copyHint.sourceLevel ?? "?"}
        </span>
        <span className="ml-[33px] min-w-0 truncate text-xs font-semibold text-sky-100/65">
          {hintedShipName}
        </span>
        <span className="absolute bottom-1 right-2 text-[9px] font-semibold text-sky-200/65">
          缺船 · 点此替换
        </span>
      </button>
    );
  }

  if (!assignment) {
    return (
      <div
        onClick={readOnly ? undefined : onClick}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
        className={cn(
          "flex min-h-[2.8rem] w-full items-center justify-center gap-1",
          "rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/40",
          "transition-all",
          readOnly ? "cursor-not-allowed opacity-60" : "hover:border-blue-400 hover:bg-blue-500/10 cursor-pointer",
          !readOnly && columnDragOver && "border-blue-400/70 bg-blue-500/10",
        )}
      >
        <span className="text-lg font-bold text-slate-500">{readOnly ? "-" : "+"}</span>
        <span className="text-[10px] text-slate-600">{readOnly ? "只读" : "选船"}</span>
      </div>
    );
  }

  const shipName = getShipName(assignment.shipId);
  const shipType = getShipType(assignment.shipId);

  return (
    <div
      draggable={!readOnly && !!onDragStart}
      onDragStart={readOnly ? undefined : onDragStart}
      onClick={readOnly ? undefined : onClick}
      onDrop={readOnly ? undefined : onDrop}
      onDragOver={readOnly ? undefined : onDragOver}
      className={cn(
        "relative flex items-center rounded-lg border border-slate-600 bg-slate-800 py-1.5 pl-2 pr-10 min-h-[2.8rem]",
        "group transition-all",
        !readOnly && onDragStart && "cursor-grab active:cursor-grabbing hover:border-slate-500",
        readOnly && "cursor-default",
        !readOnly && columnDragOver && "border-blue-400/70",
      )}
    >
      {/* Left color tag */}
      <div
        className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", getLockTagColorClassName(tagColorClass))}
        style={getLockTagStripStyle(tagColorClass)}
      />

      {/* Level — top-left corner, color by level range */}
      <span className={cn("absolute left-2 top-0.5 text-[10px] font-semibold leading-none", levelColor(ship?.level ?? 0))}>
        Lv{ship?.level ?? "?"}
      </span>

      {/* Ship name — single line, truncate with ellipsis */}
      <p className="ml-[33px] truncate text-xs font-semibold text-slate-200 leading-tight">{shipName}</p>

      {/* Remove button — top-right corner */}
      {!readOnly && (
        <button
          type="button"
          draggable={false}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-red-500/20 hover:text-red-400 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
          title="移除"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}

      {/* Ship type — bottom-right corner */}
      <span className="absolute bottom-[6px] w-8 text-left text-[10px] text-slate-400 leading-none"
        style={{ left: 'calc(100% - 1.5625rem)' }}>
        {shipType}
      </span>
    </div>
  );
}

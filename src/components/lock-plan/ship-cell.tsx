"use client";

import { type ShipStock } from "@/lib/noro6";
import { cn } from "@/lib/utils";

type ShipCellProps = {
  assignment?: { uniqueId: string; shipId: number } | null;
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
};

function levelColor(level: number): string {
  if (level >= 100) return "text-amber-400";
  if (level >= 80) return "text-green-400";
  if (level >= 50) return "text-blue-400";
  return "text-slate-500";
}

export function ShipCell({
  assignment, ship, tagColorClass, getShipName, getShipType, onClick, onRemove,
  onDragStart, onDrop, onDragOver, columnDragOver,
}: ShipCellProps) {
  if (!assignment) {
    return (
      <div
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={cn(
          "flex min-h-[2.8rem] w-full items-center justify-center gap-1",
          "rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/40",
          "transition-all hover:border-blue-400 hover:bg-blue-500/10 cursor-pointer",
          columnDragOver && "border-blue-400/70 bg-blue-500/10",
        )}
      >
        <span className="text-lg font-bold text-slate-500">+</span>
        <span className="text-[10px] text-slate-600">选船</span>
      </div>
    );
  }

  const shipName = getShipName(assignment.shipId);
  const shipType = getShipType(assignment.shipId);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className={cn(
        "relative flex items-center rounded-lg border border-slate-600 bg-slate-800 py-1.5 pl-2 pr-10 min-h-[2.8rem]",
        "group transition-all",
        onDragStart && "cursor-grab active:cursor-grabbing hover:border-slate-500",
        columnDragOver && "border-blue-400/70",
      )}
    >
      {/* Left color tag */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", tagColorClass)} />

      {/* Level — top-left corner, color by level range */}
      <span className={cn("absolute left-2 top-0.5 text-[10px] font-semibold leading-none", levelColor(ship?.level ?? 0))}>
        Lv{ship?.level ?? "?"}
      </span>

      {/* Ship name — single line, truncate with ellipsis */}
      <p className="ml-[33px] truncate text-xs font-semibold text-slate-200 leading-tight">{shipName}</p>

      {/* Remove button — top-right corner */}
      <button
        type="button"
        draggable={false}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-red-500/20 hover:text-red-400 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
        title="移除"
      >
        ✕
      </button>

      {/* Ship type — bottom-right corner */}
      <span className="absolute bottom-[6px] w-8 text-left text-[10px] text-slate-400 leading-none"
        style={{ left: 'calc(100% - 1.5625rem)' }}>
        {shipType}
      </span>
    </div>
  );
}

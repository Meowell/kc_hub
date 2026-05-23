import { shipTypeLabels, type ShipMaster } from "@/lib/master-data";

// ============================================================
// Shared helpers for lock-plan components
// Extracted from old lock-plan-board.tsx to be reusable by
// the new God-view components.
// ============================================================

export type LockAssignment = {
  uniqueId: string;
  shipId: number;
};

export const shipMasters: ShipMaster[] = [];
export const masterByShipId = new Map<number, ShipMaster>();
export { shipTypeLabels };

export function getShipName(shipId: number) {
  return `未知舰船 ${shipId}`;
}

export function getShipType(_shipId: number) {
  return "Type ?";
}

export function parseAssignments(value: string): (LockAssignment | null)[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): LockAssignment | null => {
      if (item === null) return null;
      if (
        item &&
        typeof item === "object" &&
        typeof item.uniqueId === "string" &&
        Number.isInteger(item.shipId)
      ) {
        return { uniqueId: item.uniqueId, shipId: item.shipId };
      }
      return null;
    });
  } catch {
    return [];
  }
}

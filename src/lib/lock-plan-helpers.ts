import {
  createMasterLookup,
  fallbackMasterData,
  getShipNameFromLookup,
  getShipTypeFromLookup,
  shipTypeLabels,
} from "@/lib/master-data";

// ============================================================
// Shared helpers for lock-plan components
// Extracted from old lock-plan-board.tsx to be reusable by
// the new God-view components.
// ============================================================

export type LockAssignment = {
  uniqueId: string;
  shipId: number;
};

const fallbackLookup = createMasterLookup(fallbackMasterData);

export const shipMasters = fallbackLookup.allShips;
export const masterByShipId = fallbackLookup.masterByShipId;
export { shipTypeLabels };

export function getShipName(shipId: number) {
  return getShipNameFromLookup(fallbackLookup, shipId);
}

export function getShipType(shipId: number) {
  return getShipTypeFromLookup(fallbackLookup, shipId);
}

/** Extract the max/base stat from a ship master field (number or [min, max] tuple) */
function masterStat(raw: number | number[] | undefined): number {
  if (raw === undefined) return 0;
  if (Array.isArray(raw)) {
    // Take the last element (usually the remodeled/max value)
    return raw[raw.length - 1] ?? 0;
  }
  return raw;
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

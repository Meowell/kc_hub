import start2 from "@/data/START2.json";

// ============================================================
// Shared helpers for lock-plan components
// Extracted from old lock-plan-board.tsx to be reusable by
// the new God-view components.
// ============================================================

export type LockAssignment = {
  uniqueId: string;
  shipId: number;
};

type ShipMaster = {
  api_id: number;
  api_name: string;
  api_stype: number;
  api_houg?: number | number[];
  api_raig?: number | number[];
  api_tyku?: number | number[];
  api_souk?: number | number[];
  api_luck?: number | number[];
  api_taik?: number | number[];
};

export const shipMasters = start2.api_mst_ship as ShipMaster[];
export const masterByShipId = new Map(shipMasters.map((ship) => [ship.api_id, ship]));

export const shipTypeLabels: Record<number, string> = {
  1: "DE",
  2: "DD",
  3: "CL",
  4: "CLT",
  5: "CA",
  6: "CAV",
  7: "CVL",
  8: "FBB",
  9: "BB",
  10: "BBV",
  11: "CV",
  16: "AV",
  17: "LHA",
  18: "SS",
  19: "SSV",
};

export function getShipName(shipId: number) {
  return masterByShipId.get(shipId)?.api_name ?? `未知舰船 ${shipId}`;
}

export function getShipType(shipId: number) {
  const typeId = masterByShipId.get(shipId)?.api_stype ?? 0;
  return shipTypeLabels[typeId] ?? `Type ${typeId || "?"}`;
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

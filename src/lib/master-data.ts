import start2Fallback from "@/data/START2.json";
import shipHpFallback from "@/data/shipHp.json";

export type ShipMaster = {
  api_id: number;
  api_name: string;
  api_stype: number;
  api_aftershipid?: string;
  api_taik?: number | number[];
  api_houg?: number | number[];
  api_raig?: number | number[];
  api_tyku?: number | number[];
  api_souk?: number | number[];
  api_luck?: number | number[];
  api_maxeq?: number[];
  api_slot_num?: number;
};

export type EquipMaster = {
  api_id: number;
  api_name: string;
  api_type?: number[];
};

export type StypeMaster = { api_id: number; api_name: string };
export type EquipTypeMaster = { api_id: number; api_name: string };

export type Start2Data = {
  api_mst_ship: ShipMaster[];
  api_mst_slotitem: EquipMaster[];
  api_mst_stype: StypeMaster[];
  api_mst_slotitem_equiptype: EquipTypeMaster[];
  [key: string]: unknown;
};

export type ShipHpEntry = {
  id: number;
  hp: number;
  hp2: number;
  max_hp: number;
  orig?: number;
};

export type MasterData = {
  start2: Start2Data;
  shipHp: ShipHpEntry[];
  source: "fallback" | "runtime";
  loadedAt?: string;
  runtimeFiles?: {
    start2: boolean;
    shipHp: boolean;
  };
};

export type MasterLookup = ReturnType<typeof createMasterLookup>;

export const fallbackMasterData: MasterData = {
  start2: start2Fallback as Start2Data,
  shipHp: shipHpFallback as ShipHpEntry[],
  source: "fallback",
  runtimeFiles: {
    start2: false,
    shipHp: false,
  },
};

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

function getRemodelRoot(shipId: number, remodelFrom: Map<number, number>): number {
  let cur = shipId;
  const seen = new Set<number>();
  while (true) {
    const from = remodelFrom.get(cur);
    if (!from || seen.has(from)) break;
    seen.add(from);
    cur = from;
  }
  return cur;
}

export function createMasterLookup(masterData: MasterData = fallbackMasterData) {
  const allShips = masterData.start2.api_mst_ship ?? [];
  const shipNameById = new Map(allShips.map((ship) => [ship.api_id, ship.api_name]));
  const shipBaseById = new Map(allShips.map((ship) => [ship.api_id, ship]));
  const masterByShipId = shipBaseById;
  const shipTypeById = new Map(allShips.map((ship) => [ship.api_id, ship.api_stype]));
  const stypeNameById = new Map(
    (masterData.start2.api_mst_stype ?? []).map((type) => [type.api_id, type.api_name]),
  );

  const shipHpById = new Map((masterData.shipHp ?? []).map((ship) => [ship.id, ship]));

  const shipSlotsById = new Map<number, number[]>();
  const shipSlotCountById = new Map<number, number>();
  for (const ship of allShips) {
    if (ship.api_maxeq && ship.api_maxeq.length > 0) {
      shipSlotsById.set(ship.api_id, ship.api_maxeq);
    }
    shipSlotCountById.set(ship.api_id, ship.api_slot_num ?? (ship.api_maxeq?.length ?? 4));
  }

  const remodelFrom = new Map<number, number>();
  for (const ship of allShips) {
    const after = ship.api_aftershipid ? Number(ship.api_aftershipid) : 0;
    if (after) remodelFrom.set(after, ship.api_id);
  }
  const origByShipId = new Map<number, number>();
  for (const ship of allShips) {
    origByShipId.set(ship.api_id, getRemodelRoot(ship.api_id, remodelFrom));
  }

  const equipNameById = new Map<number, string>();
  const equipTypeById = new Map<number, number>();
  for (const equip of masterData.start2.api_mst_slotitem ?? []) {
    equipNameById.set(equip.api_id, equip.api_name);
    equipTypeById.set(equip.api_id, equip.api_type?.[2] ?? 0);
  }

  const equipTypeNameById = new Map(
    (masterData.start2.api_mst_slotitem_equiptype ?? []).map((type) => [type.api_id, type.api_name]),
  );

  return {
    allShips,
    shipNameById,
    shipBaseById,
    masterByShipId,
    shipTypeById,
    stypeNameById,
    shipHpById,
    shipSlotsById,
    shipSlotCountById,
    equipNameById,
    equipTypeById,
    equipTypeNameById,
    origByShipId,
  };
}

export function getShipNameFromLookup(lookup: MasterLookup, shipId: number) {
  return lookup.shipNameById.get(shipId) ?? `未知舰船 ${shipId}`;
}

export function getShipTypeFromLookup(lookup: MasterLookup, shipId: number) {
  const typeId = lookup.shipTypeById.get(shipId) ?? 0;
  return shipTypeLabels[typeId] ?? `Type ${typeId || "?"}`;
}

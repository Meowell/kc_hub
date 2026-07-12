import { createMasterLookup, emptyMasterData, type MasterData } from "@/lib/master-data";

/* ── Lookup maps ── */

/* ── Proficiency level display ── */

const PROFICIENCY_DISPLAY: Record<number, string> = {
  0: "",
  1: "|",
  2: "||",
  3: "|||",
  4: "/",
  5: "//",
  6: "///",
  7: ">>",
};

/* ── DeckBuilder raw types ── */

type DBItem = { id: number; rf?: number; mas?: number };
type DBShip = {
  id: number;
  lv: number;
  luck: number;
  items: Record<string, DBItem>;
};
type DBFleet = Record<string, unknown> & {
  name?: string;
  t?: number;
};

/* ── Parsed output types ── */

export type ParsedEquipment = {
  equipId: number;
  name: string;
  improvement?: number;
  proficiency?: string;
  isExpanded: boolean;
  slotCount?: number;
};

export type ParsedShip = {
  name: string;
  id: number;
  level: number;
  hp: number;
  maxHp: number;
  slotCount: number;
  equipment: ParsedEquipment[];
};

export type FleetGroupKey = "f1" | "f2";
export type ParsedFleetKind = "single" | "strike" | "combined";

export type ParsedFleetGroup = {
  key: FleetGroupKey;
  name?: string;
  ships: ParsedShip[];
};

export type ParsedFleet = {
  groups: ParsedFleetGroup[];
  kind: ParsedFleetKind;
  fleetType: number;
};

export type SerializableFleet = {
  groups: Array<{
    key: FleetGroupKey;
    name?: string;
    ships: Array<{
      id: number;
      level: number;
      slotCount: number;
      equipment: Array<{
        equipId: number | null;
        improvement?: number;
      }>;
    }>;
  }>;
  kind: ParsedFleetKind;
  fleetType: number;
};

export function serializeDeckBuilderFleet(fleet: SerializableFleet): string {
  const output: Record<string, unknown> = { version: 4 };

  fleet.groups.forEach((group) => {
    const serialized: Record<string, unknown> = {};
    if (group.name) serialized.name = group.name;
    if (fleet.kind === "combined") serialized.t = fleet.fleetType > 0 ? fleet.fleetType : 1;

    group.ships.forEach((ship, shipIndex) => {
      const items: Record<string, unknown> = {};
      ship.equipment.forEach((equipment, equipmentIndex) => {
        if (!equipment.equipId) return;
        const key = equipmentIndex === ship.slotCount ? "ix" : `i${equipmentIndex + 1}`;
        items[key] = { id: equipment.equipId, rf: equipment.improvement ?? 0 };
      });
      serialized[`s${shipIndex + 1}`] = {
        id: ship.id,
        lv: ship.level,
        luck: 0,
        items,
      };
    });

    output[group.key] = serialized;
  });

  return JSON.stringify(output);
}

/* ── Battle Result types ── */

type BRShip = {
  api_ship_id: number;
  api_lv: number;
  api_nowhp?: number;
  api_maxhp?: number;
  api_onslot?: number[];
  poi_slot?: (BRSlotItem | null)[];
  poi_slot_ex?: BRSlotItem | null;
};

type BRSlotItem = {
  api_slotitem_id: number;
  api_level?: number;
  api_alv?: number;
};

type BRFleet = {
  type?: number;
  main?: BRShip[];
  escort?: BRShip[];
  combined?: BRShip[];
};

/* ── Parser ── */

export function createFleetParser(masterData: MasterData = emptyMasterData) {
  const lookup = createMasterLookup(masterData);
  const {
    shipNameById,
    shipHpById,
    shipSlotsById,
    shipSlotCountById,
    equipNameById,
  } = lookup;

  function parseBattleShips(rawShips: BRShip[], limit: number): ParsedShip[] {
    const ships: ParsedShip[] = [];
    for (const raw of rawShips.slice(0, limit)) {
      if (!raw?.api_ship_id) continue;

      const shipName = shipNameById.get(raw.api_ship_id) ?? `ID:${raw.api_ship_id}`;
      const hpData = shipHpById.get(raw.api_ship_id);
      const maxHp = hpData?.max_hp ?? hpData?.hp ?? 99;
      const slotCount = shipSlotCountById.get(raw.api_ship_id) ?? 4;
      const slotCaps = shipSlotsById.get(raw.api_ship_id) ?? [];

      const equipment: ParsedEquipment[] = [];

      // Regular slots from poi_slot
      const poiSlots = raw.poi_slot || [];
      for (let si = 0; si < poiSlots.length; si++) {
        const item = poiSlots[si];
        if (item && item.api_slotitem_id) {
          const eqName = equipNameById.get(item.api_slotitem_id) ?? `装備ID:${item.api_slotitem_id}`;
          const improvement = (item.api_level && item.api_level > 0) ? item.api_level : undefined;
          const profRaw = item.api_alv ?? 0;
          const proficiency = PROFICIENCY_DISPLAY[profRaw] || "";

          equipment.push({
            equipId: item.api_slotitem_id,
            name: eqName,
            improvement,
            proficiency,
            isExpanded: false,
            slotCount: si < slotCaps.length ? slotCaps[si] : undefined,
          });
        }
      }

      // Expansion slot
      if (raw.poi_slot_ex && raw.poi_slot_ex.api_slotitem_id) {
        const ex = raw.poi_slot_ex;
        const eqName = equipNameById.get(ex.api_slotitem_id) ?? `装備ID:${ex.api_slotitem_id}`;
        const improvement = (ex.api_level && ex.api_level > 0) ? ex.api_level : undefined;
        equipment.push({
          equipId: ex.api_slotitem_id,
          name: eqName,
          improvement,
          proficiency: "",
          isExpanded: true,
          slotCount: undefined,
        });
      }

      ships.push({
        name: shipName,
        id: raw.api_ship_id,
        level: raw.api_lv,
        hp: maxHp,
        maxHp,
        slotCount,
        equipment,
      });
    }

    return ships;
  }

  function parseBattleResult(json: Record<string, unknown>): ParsedFleet | null {
    const fleet = json.fleet as BRFleet | undefined;
    if (!fleet?.main || !Array.isArray(fleet.main)) return null;

    const escortRaw = Array.isArray(fleet.escort)
      ? fleet.escort
      : Array.isArray(fleet.combined)
        ? fleet.combined
        : [];
    const isCombined = escortRaw.length > 0;
    const mainShips = parseBattleShips(fleet.main, isCombined ? 6 : 7);
    const escortShips = parseBattleShips(escortRaw, 6);
    if (mainShips.length === 0) return null;

    const groups: ParsedFleetGroup[] = [{ key: "f1", ships: mainShips }];
    if (escortShips.length > 0) groups.push({ key: "f2", ships: escortShips });

    return {
      groups,
      kind: isCombined ? "combined" : mainShips.length > 6 ? "strike" : "single",
      fleetType: isCombined && [1, 2, 3].includes(fleet.type ?? 0) ? fleet.type! : isCombined ? 1 : 0,
    };
  }

  function parseDeckBuilderShips(fleetData: DBFleet, limit: number): ParsedShip[] {
    const ships: ParsedShip[] = [];

    for (let i = 1; i <= limit; i++) {
      const key = `s${i}`;
      const raw = fleetData[key] as DBShip | undefined;
      if (!raw) continue;

      const shipName = shipNameById.get(raw.id) ?? `ID:${raw.id}`;
      const hpData = shipHpById.get(raw.id);
      const maxHp = hpData?.max_hp ?? hpData?.hp ?? 99;
      const slots = shipSlotsById.get(raw.id) ?? [];

      // Parse equipment
      const equipment: ParsedEquipment[] = [];
      const itemKeys = Object.keys(raw.items || {}).sort(); // i1, i2, ..., ix

      for (const k of itemKeys) {
        const item = raw.items[k];
        if (!item || !item.id) continue;

        const isExpanded = k === "ix";
        const eqName = equipNameById.get(item.id) ?? `装備ID:${item.id}`;
        const improvement = item.rf && item.rf > 0 ? item.rf : undefined;
        const profRaw = item.mas ?? 0;
        const proficiency = PROFICIENCY_DISPLAY[profRaw] || "";

        // Slot capacity: match regular slots (i1, i2...) with api_maxeq order,
        // expansion slot (ix) has no capacity
        let slotCount: number | undefined;
        if (!isExpanded) {
          const regularIndex = itemKeys.filter((ik) => ik !== "ix").indexOf(k);
          if (regularIndex >= 0 && regularIndex < slots.length) {
            slotCount = slots[regularIndex];
          }
        }

        equipment.push({
          equipId: item.id,
          name: eqName,
          improvement,
          proficiency,
          isExpanded,
          slotCount,
        });
      }

      ships.push({
        name: shipName,
        id: raw.id,
        level: raw.lv,
        hp: maxHp,
        maxHp,
        slotCount: shipSlotCountById.get(raw.id) ?? 4,
        equipment,
      });
    }

    return ships;
  }

  function parseDeckBuilderJson(json: Record<string, unknown>): ParsedFleet | null {
    const f1 = json.f1 as DBFleet | undefined;
    const f2 = json.f2 as DBFleet | undefined;
    if (!f1) return null;

    const parsedFleetType = Number(f1.t ?? f2?.t ?? 0);
    const fleetType = Number.isFinite(parsedFleetType) && parsedFleetType > 0 ? parsedFleetType : 0;
    const isCombined = fleetType > 0;
    const mainShips = parseDeckBuilderShips(f1, isCombined ? 6 : 7);
    if (mainShips.length === 0) return null;

    const groups: ParsedFleetGroup[] = [{ key: "f1", name: f1.name, ships: mainShips }];
    if (isCombined && f2) {
      const escortShips = parseDeckBuilderShips(f2, 6);
      if (escortShips.length > 0) groups.push({ key: "f2", name: f2.name, ships: escortShips });
    }

    return {
      groups,
      kind: isCombined ? "combined" : mainShips.length > 6 ? "strike" : "single",
      fleetType,
    };
  }

  function parseFleetData(text: string): ParsedFleet | null {
    try {
      const json = JSON.parse(text.trim());

      // Auto-detect format
      if (json.f1) {
        // DeckBuilder format
        return parseDeckBuilderJson(json);
      }
      if (json.fleet) {
        // Battle result format
        return parseBattleResult(json);
      }
      return null;
    } catch {
      return null;
    }
  }

  return {
    parseFleetData,
    equipNameMap: equipNameById,
    shipSlotCountMap: shipSlotCountById,
  };
}

export type FleetParser = ReturnType<typeof createFleetParser>;

const defaultFleetParser = createFleetParser();

export const parseFleetData = defaultFleetParser.parseFleetData;
export const equipNameMap = defaultFleetParser.equipNameMap;
export const shipSlotCountMap = defaultFleetParser.shipSlotCountMap;

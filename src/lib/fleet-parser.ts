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
type DBFleet = Record<string, DBShip>;

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

export type ParsedFleet = {
  ships: ParsedShip[];
};

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

  function parseBattleResult(json: Record<string, unknown>): ParsedFleet | null {
    const fleet = json.fleet as BRFleet | undefined;
    if (!fleet?.main || !Array.isArray(fleet.main)) return null;

    const ships: ParsedShip[] = [];
    for (const raw of fleet.main.slice(0, 6)) {
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

    return ships.length > 0 ? { ships } : null;
  }

  function parseDeckBuilderJson(json: Record<string, unknown>): ParsedFleet | null {
    const fleetData = json.f1 as DBFleet | undefined;
    if (!fleetData) return null;

    const ships: ParsedShip[] = [];

    // Iterate s1~s6
    for (let i = 1; i <= 6; i++) {
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

    if (ships.length === 0) return null;
    return { ships };
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

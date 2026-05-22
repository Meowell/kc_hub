import { createMasterLookup, fallbackMasterData, type ShipMaster } from "@/lib/master-data";

export type Noro6Ship = {
  id: number;
  lv: number;
  st?: number[];
};

export type Noro6Data = {
  ships: Noro6Ship[];
  items: Array<{
    id: number;
    lv?: number;
  }>;
};

export type ShipStock = {
  uniqueId: string;
  shipId: number;
  level: number;
  firepower: number;
  torpedo: number;
  antiAir: number;
  armor: number;
  luck: number;
  hp: number;
  asw: number;
};

const fallbackMasterByShipId = createMasterLookup(fallbackMasterData).masterByShipId;

export function extractNoro6JsonText(value: string) {
  const trimmed = value.trim();
  const marker = "#import:";
  const markerIndex = trimmed.indexOf(marker);

  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + marker.length).trim();
  }

  return trimmed;
}

/**
 * 提取已有存档中的 ships/items 数组
 */
function extractExisting(existingShipData?: string): { ships: unknown[]; items: unknown[] } {
  if (!existingShipData) return { ships: [], items: [] };
  try {
    const parsed = JSON.parse(extractNoro6JsonText(existingShipData));
    if (!Array.isArray(parsed)) {
      return {
        ships: (parsed as Record<string, unknown>).ships as unknown[] || [],
        items: (parsed as Record<string, unknown>).items as unknown[] || [],
      };
    }
  } catch { /* ignore */ }
  return { ships: [], items: [] };
}

/**
 * 归一化三种输入格式为标准存档格式，与已有数据合并：
 * 1. 完整格式:  替换全部
 * 2. 纯舰船:   只更新 ships，items 保留已有
 * 3. 纯装备:   只更新 items，ships 保留已有
 */
export function normalizeNoro6Input(value: string, existingShipData?: string): string {
  const { ships: existingShips, items: existingItems } = extractExisting(existingShipData);

  const jsonText = extractNoro6JsonText(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("noro6 存档不是合法 JSON");
  }

  if (!Array.isArray(parsed)) {
    // 完整格式：替换全部
    const obj = parsed as Record<string, unknown>;
    return JSON.stringify({
      predeck: obj.predeck || {},
      ships: obj.ships || [],
      items: obj.items || [],
    });
  }

  if (parsed.length === 0) {
    return JSON.stringify({ predeck: {}, ships: existingShips, items: existingItems });
  }

  const first = parsed[0] as Record<string, unknown> | null;
  if (first && typeof first === "object" && ("st" in first || "exp" in first)) {
    // 纯舰船格式：合并已有装备
    return JSON.stringify({ predeck: {}, ships: parsed, items: existingItems });
  }

  // 纯装备格式：合并已有舰船
  return JSON.stringify({ predeck: {}, ships: existingShips, items: parsed });
}

export function parseNoro6Data(value: string): Noro6Data {
  let parsed: unknown;

  try {
    parsed = JSON.parse(extractNoro6JsonText(value));
  } catch {
    throw new Error("noro6 存档不是合法 JSON：请确认复制了 #import: 后面的完整内容。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("noro6 存档格式错误：根节点必须是对象。");
  }

  const data = parsed as { ships?: unknown; items?: unknown };

  if (!Array.isArray(data.ships)) {
    throw new Error("noro6 存档格式错误：缺少 ships 数组。");
  }

  if (!Array.isArray(data.items)) {
    throw new Error("noro6 存档格式错误：缺少 items 数组。请复制 total.txt 对应的完整存档。");
  }

  const ships = data.ships.map((ship, index) => {
    if (!ship || typeof ship !== "object") {
      throw new Error(`noro6 存档格式错误：ships[${index}] 不是对象。`);
    }

    const raw = ship as Record<string, unknown>;
    const id = raw.ship_id ?? raw.id;
    const lv = raw.lv;

    if (!Number.isInteger(id) || !Number.isInteger(lv)) {
      throw new Error(`noro6 存档格式错误：ships[${index}] 必须包含数字 id/ship_id 和 lv。`);
    }

    return {
      id: id as number,
      lv: lv as number,
      st: Array.isArray(raw.st) ? (raw.st as unknown[]).filter((value): value is number => typeof value === "number") : undefined,
    };
  });

  return {
    ships,
    items: data.items as Noro6Data["items"],
  };
}

export function deriveShipStock(
  shipData: string,
  masterByShipId: Map<number, ShipMaster> = fallbackMasterByShipId,
): ShipStock[] {

  const occurrenceByShipId = new Map<number, number>();

  function baseMin(raw: unknown): number {
    if (Array.isArray(raw)) return (raw[0] as number) ?? 0;
    if (typeof raw === "number") return raw;
    return 0;
  }

  return parseNoro6Data(shipData).ships.map((ship) => {
    const occurrence = occurrenceByShipId.get(ship.id) ?? 0;
    occurrenceByShipId.set(ship.id, occurrence + 1);
    const mod = ship.st ?? [];
    const base = masterByShipId.get(ship.id);

    return {
      uniqueId: `${ship.id}:${occurrence}`,
      shipId: ship.id,
      level: ship.lv,
      firepower: baseMin(base?.api_houg) + (mod[0] ?? 0),
      torpedo: baseMin(base?.api_raig) + (mod[1] ?? 0),
      antiAir: baseMin(base?.api_tyku) + (mod[2] ?? 0),
      armor: baseMin(base?.api_souk) + (mod[3] ?? 0),
      luck: baseMin(base?.api_luck) + (mod[4] ?? 0),
      hp: baseMin(base?.api_taik) + (mod[5] ?? 0),
      asw: (mod[6] ?? 0),
    };
  });
}

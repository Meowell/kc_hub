import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

import {
  fallbackMasterData,
  type MasterData,
  type ShipHpEntry,
  type Start2Data,
} from "@/lib/master-data";

const START2_FILE = "START2.json";
const SHIP_HP_FILE = "shipHp.json";

export const masterDataDir =
  process.env.MASTER_DATA_DIR ?? path.join(process.cwd(), "runtime-data", "master-data");

async function readRuntimeJson<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(masterDataDir, fileName), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(fileName: string, value: unknown) {
  await mkdir(masterDataDir, { recursive: true });
  const filePath = path.join(masterDataDir, fileName);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(value), "utf8");
  await rename(tempPath, filePath);
}

export async function loadMasterData(): Promise<MasterData> {
  const [runtimeStart2, runtimeShipHp] = await Promise.all([
    readRuntimeJson<Start2Data>(START2_FILE),
    readRuntimeJson<ShipHpEntry[]>(SHIP_HP_FILE),
  ]);

  const hasRuntimeStart2 = !!runtimeStart2;
  const hasRuntimeShipHp = !!runtimeShipHp;

  return {
    start2: runtimeStart2 ?? fallbackMasterData.start2,
    shipHp: runtimeShipHp ?? fallbackMasterData.shipHp,
    source: hasRuntimeStart2 || hasRuntimeShipHp ? "runtime" : "fallback",
    loadedAt: new Date().toISOString(),
    runtimeFiles: {
      start2: hasRuntimeStart2,
      shipHp: hasRuntimeShipHp,
    },
  };
}

export async function writeRuntimeMasterData(data: {
  start2?: Start2Data;
  shipHp?: ShipHpEntry[];
}) {
  const writes: Promise<void>[] = [];
  if (data.start2) writes.push(writeJsonAtomic(START2_FILE, data.start2));
  if (data.shipHp) writes.push(writeJsonAtomic(SHIP_HP_FILE, data.shipHp));
  await Promise.all(writes);
}

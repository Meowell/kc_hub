import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

import { fallbackMasterData } from "@/lib/master-data-fallback";
import {
  type MasterData,
  type ShipHpEntry,
  type Start2Data,
} from "@/lib/master-data";

const START2_FILE = "START2.json";
const SHIP_HP_FILE = "shipHp.json";
const MASTER_DATA_ASSET_DIR = "assets";
const MASTER_DATA_VERSION_PATTERN = /^[a-f0-9]{64}$/;

export const masterDataDir =
  process.env.MASTER_DATA_DIR ?? path.join(process.cwd(), "runtime-data", "master-data");

export type MasterDataManifest = {
  version: string;
  url: string;
};

let cachedManifest: MasterDataManifest | null = null;

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
    runtimeFiles: {
      start2: hasRuntimeStart2,
      shipHp: hasRuntimeShipHp,
    },
  };
}

export async function getMasterDataManifest(): Promise<MasterDataManifest> {
  if (cachedManifest) return cachedManifest;

  const data = await loadMasterData();
  const serialized = JSON.stringify(data);
  const version = createHash("sha256").update(serialized).digest("hex");
  const assetDir = path.join(masterDataDir, MASTER_DATA_ASSET_DIR);
  const filePath = path.join(assetDir, `${version}.json`);

  try {
    await access(filePath);
  } catch {
    await mkdir(assetDir, { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, serialized, "utf8");
    await rename(tempPath, filePath);
  }

  cachedManifest = {
    version,
    url: `/master-data/${version}.json`,
  };
  return cachedManifest;
}

export async function readMasterDataAsset(version: string): Promise<Buffer | null> {
  if (!MASTER_DATA_VERSION_PATTERN.test(version)) return null;

  try {
    return await readFile(
      path.join(masterDataDir, MASTER_DATA_ASSET_DIR, `${version}.json`),
    );
  } catch {
    return null;
  }
}

export async function writeRuntimeMasterData(data: {
  start2?: Start2Data;
  shipHp?: ShipHpEntry[];
}) {
  const writes: Promise<void>[] = [];
  if (data.start2) writes.push(writeJsonAtomic(START2_FILE, data.start2));
  if (data.shipHp) writes.push(writeJsonAtomic(SHIP_HP_FILE, data.shipHp));
  if (writes.length > 0) cachedManifest = null;
  await Promise.all(writes);
}

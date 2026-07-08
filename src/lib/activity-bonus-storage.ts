import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizeActivityBonusConfig,
  parseActivityBonusConfig,
  stringifyActivityBonusConfig,
  type ActivityBonusConfig,
} from "@/lib/activity-bonus";

const BONUS_DATA_DIR = path.join(process.cwd(), "runtime-data", "activity-bonus");

function bonusFilePath(activityId: string) {
  return path.join(BONUS_DATA_DIR, `${encodeURIComponent(activityId)}.json`);
}

export async function readActivityBonusRaw(activityId: string | null | undefined) {
  if (!activityId) return "";

  try {
    return await readFile(bonusFilePath(activityId), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

export async function readActivityBonusConfig(activityId: string | null | undefined): Promise<ActivityBonusConfig> {
  return parseActivityBonusConfig(await readActivityBonusRaw(activityId));
}

export async function writeActivityBonusConfig(activityId: string, input: unknown) {
  const config = normalizeActivityBonusConfig(input);
  const data = stringifyActivityBonusConfig(config);
  await mkdir(BONUS_DATA_DIR, { recursive: true });
  await writeFile(bonusFilePath(activityId), data, "utf8");
  return data;
}

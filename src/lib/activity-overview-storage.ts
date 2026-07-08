import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeActivityOverview, type ActivityOverview } from "@/lib/activity-overview";

const OVERVIEW_DATA_DIR = path.join(process.cwd(), "runtime-data", "activity-overview");

function overviewFilePath(activityId: string) {
  return path.join(OVERVIEW_DATA_DIR, `${encodeURIComponent(activityId)}.json`);
}

export async function readActivityOverview(
  activityId: string | null | undefined,
  fallbackTitle: string,
): Promise<ActivityOverview> {
  if (!activityId) return normalizeActivityOverview({}, fallbackTitle);

  try {
    const raw = await readFile(overviewFilePath(activityId), "utf8");
    return normalizeActivityOverview(JSON.parse(raw), fallbackTitle);
  } catch (error) {
    if (error instanceof SyntaxError) return normalizeActivityOverview({}, fallbackTitle);
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return normalizeActivityOverview({}, fallbackTitle);
    }
    throw error;
  }
}

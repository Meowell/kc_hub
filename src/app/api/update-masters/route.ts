import { NextResponse } from "next/server";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeRuntimeMasterData } from "@/lib/master-data-server";
import type { ShipHpEntry, Start2Data } from "@/lib/master-data";

const MASTER_URL =
  "https://firebasestorage.googleapis.com/v0/b/development-74af0.appspot.com/o/master.json?alt=media";
const START2_URL = "https://raw.githubusercontent.com/noro6/kc-web/main/START2.json";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_MASTER_BYTES = 10 * 1024 * 1024;
const MAX_START2_BYTES = 20 * 1024 * 1024;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fetchJson(url: string, maxBytes: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      throw new Error(`响应过大: ${contentLength} bytes`);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new Error("响应过大");
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

function validateStart2(value: unknown): Start2Data {
  if (!value || typeof value !== "object") {
    throw new Error("START2 根节点不是对象");
  }
  const data = value as Start2Data;
  if (!Array.isArray(data.api_mst_ship)) {
    throw new Error("START2 缺少 api_mst_ship 数组");
  }
  if (!Array.isArray(data.api_mst_slotitem)) {
    throw new Error("START2 缺少 api_mst_slotitem 数组");
  }
  return data;
}

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const results: string[] = [];
  const errors: string[] = [];

  // 1. 更新 shipHp.json
  try {
    const master = (await fetchJson(MASTER_URL, MAX_MASTER_BYTES)) as { ships?: ShipHpEntry[] };
    if (!master.ships || !Array.isArray(master.ships)) {
      throw new Error("master.json 缺少 ships 数组");
    }
    const hpData = master.ships.map((s) => ({
      id: s.id,
      hp: s.hp,
      hp2: s.hp2,
      max_hp: s.max_hp,
      orig: s.orig,
    }));
    await writeRuntimeMasterData({ shipHp: hpData });
    results.push("HP 运行时数据已更新");
  } catch (err) {
    errors.push(`HP 数据: ${err instanceof Error ? err.message : "失败"}`);
  }

  // 2. 更新 START2.json
  try {
    const start2 = validateStart2(await fetchJson(START2_URL, MAX_START2_BYTES));
    await writeRuntimeMasterData({ start2 });
    results.push("START2 运行时数据已更新");
  } catch (err) {
    errors.push(`START2: ${err instanceof Error ? err.message : "失败"}`);
  }

  if (errors.length > 0 && results.length === 0) {
    return NextResponse.json({ success: false, results, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, results, errors: errors.length ? errors : undefined });
}

import { NextResponse } from "next/server";
import { execFile } from "child_process";

import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import { writeRuntimeMasterData } from "@/lib/master-data-server";
import type { ShipHpEntry, Start2Data } from "@/lib/master-data";

const MASTER_SOURCES = [
  {
    label: "Firebase master.json",
    url: "https://firebasestorage.googleapis.com/v0/b/development-74af0.appspot.com/o/master.json?alt=media",
  },
];

const START2_SOURCES = [
  {
    label: "noro6/kc-web public/START2.json",
    url: "https://raw.githubusercontent.com/noro6/kc-web/main/public/START2.json",
  },
  {
    label: "noro6/kc-web legacy START2.json",
    url: "https://raw.githubusercontent.com/noro6/kc-web/main/START2.json",
  },
];

const FETCH_TIMEOUT_MS = 30_000;
const MAX_MASTER_BYTES = 10 * 1024 * 1024;
const MAX_START2_BYTES = 20 * 1024 * 1024;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonSource = {
  label: string;
  url: string;
};

class HttpStatusError extends Error {
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
  }
}

function toErrorMessage(err: unknown) {
  if (err instanceof Error) {
    if (err.name === "AbortError") return "请求超时";
    return err.message;
  }
  return "失败";
}

async function fetchTextWithNativeFetch(url: string, maxBytes: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpStatusError(response.status);
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      throw new Error(`响应过大: ${contentLength} bytes`);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new Error("响应过大");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithCurl(url: string, maxBytes: number) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "curl",
      [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--compressed",
        "--connect-timeout",
        "10",
        "--max-time",
        String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
        "--user-agent",
        "kancolle-hub-data-updater/1.0",
        url,
      ],
      { encoding: "utf8", maxBuffer: maxBytes + 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr.trim() || err.message;
          reject(new Error(`curl: ${detail}`));
          return;
        }
        if (new TextEncoder().encode(stdout).length > maxBytes) {
          reject(new Error("响应过大"));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

async function fetchText(url: string, maxBytes: number) {
  try {
    return await fetchTextWithNativeFetch(url, maxBytes);
  } catch (err) {
    if (err instanceof HttpStatusError) throw err;
    try {
      return await fetchTextWithCurl(url, maxBytes);
    } catch (curlErr) {
      throw new Error(`${toErrorMessage(err)}; ${toErrorMessage(curlErr)}`);
    }
  }
}

async function fetchJsonFromSources(sources: JsonSource[], maxBytes: number): Promise<unknown> {
  const errors: string[] = [];
  for (const source of sources) {
    try {
      const text = await fetchText(source.url, maxBytes);
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error(`JSON 解析失败: ${toErrorMessage(err)}`);
      }
    } catch (err) {
      errors.push(`${source.label}: ${toErrorMessage(err)}`);
    }
  }
  throw new Error(errors.join("；"));
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
    const master = (await fetchJsonFromSources(MASTER_SOURCES, MAX_MASTER_BYTES)) as {
      ships?: ShipHpEntry[];
    };
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
    const start2 = validateStart2(await fetchJsonFromSources(START2_SOURCES, MAX_START2_BYTES));
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

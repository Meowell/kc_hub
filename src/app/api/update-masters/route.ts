import { NextResponse } from "next/server";
import { getApiUser, unauthorizedApiResponse } from "@/lib/auth";
import fs from "fs";
import path from "path";
import https from "https";

const MASTER_URL =
  "https://firebasestorage.googleapis.com/v0/b/development-74af0.appspot.com/o/master.json?alt=media";
const START2_URL = "https://raw.githubusercontent.com/noro6/kc-web/main/START2.json";

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorizedApiResponse();

  const results: string[] = [];
  const errors: string[] = [];

  // 1. 更新 shipHp.json
  try {
    const master = (await fetchJson(MASTER_URL)) as { ships?: { id: number; hp: number; hp2: number; max_hp: number }[] };
    if (!master.ships || !Array.isArray(master.ships)) {
      throw new Error("master.json 缺少 ships 数组");
    }
    const hpData = master.ships.map((s) => ({
      id: s.id,
      hp: s.hp,
      hp2: s.hp2,
      max_hp: s.max_hp,
    }));
    const hpPath = path.join(process.cwd(), "src/data/shipHp.json");
    fs.writeFileSync(hpPath, JSON.stringify(hpData));
    results.push("最新数据已更新");
  } catch (err) {
    errors.push(`HP 数据: ${err instanceof Error ? err.message : "失败"}`);
  }

  // 2. 更新 START2.json
  try {
    const start2 = await fetchJson(START2_URL);
    const start2Path = path.join(process.cwd(), "src/data/START2.json");
    fs.writeFileSync(start2Path, JSON.stringify(start2));
    results.push("最新数据已更新");
  } catch (err) {
    errors.push(`START2: ${err instanceof Error ? err.message : "失败"}`);
  }

  if (errors.length > 0 && results.length === 0) {
    return NextResponse.json({ success: false, results, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, results, errors: errors.length ? errors : undefined });
}

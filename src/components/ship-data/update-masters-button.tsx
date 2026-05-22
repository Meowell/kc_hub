"use client";

import { useState } from "react";
import { notifyMasterDataUpdated } from "@/lib/master-data-events";

async function updateMasters(): Promise<{ success: boolean; results: string[]; errors?: string[] }> {
  const res = await fetch("/api/update-masters", { method: "POST" });
  return res.json();
}

export function UpdateMastersButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleClick() {
    setLoading(true);
    setMsg("");
    setErr("");
    try {
      const data = await updateMasters();
      if (data.success) {
        setMsg(data.results.join(" · "));
        notifyMasterDataUpdated();
      } else {
        setErr((data.errors ?? ["更新失败"]).join("\n"));
      }
    } catch {
      setErr("请求失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500/50 hover:bg-slate-700/60 transition-all disabled:opacity-50"
      >
        <span>{loading ? "⏳" : "🔄"}</span>
        <span>{loading ? "更新中..." : "抓取数据"}</span>
      </button>
      {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      {err && <span className="text-xs text-red-400 whitespace-pre-line">{err}</span>}
    </div>
  );
}

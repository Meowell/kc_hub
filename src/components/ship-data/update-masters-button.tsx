"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:border-slate-500/50 hover:bg-slate-700/60 hover:text-slate-100 disabled:opacity-50"
      >
        <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
        <span>{loading ? "更新中…" : "抓取数据"}</span>
      </button>
      {msg && <span role="status" className="text-sm text-emerald-300">{msg}</span>}
      {err && <span role="alert" className="whitespace-pre-line text-sm text-red-300">{err}</span>}
    </div>
  );
}

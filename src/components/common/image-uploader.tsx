"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ImageUploader({
  label, icon, initialUrl, apiEndpoint, fieldName, preview, reloadOnChange,
}: {
  label: string; icon: ReactNode; initialUrl: string | null;
  apiEndpoint: string; fieldName: string; preview: ReactNode;
  reloadOnChange?: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handleUpload(file: File) {
    setUploading(true); setErr("");
    try {
      const data = new FormData(); data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const p = await res.json();
      if (!res.ok) throw new Error(p.error ?? "上传失败");
      const newUrl = p.imageUrl as string;
      const patchRes = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [fieldName]: newUrl }),
      });
      if (!patchRes.ok) throw new Error("保存失败");
      setUrl(newUrl);
      if (reloadOnChange) window.location.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "上传失败"); }
    finally { setUploading(false); }
  }

  async function handleRemove() {
    setErr("");
    const res = await fetch(apiEndpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [fieldName]: null }),
    });
    if (!res.ok) { setErr("清除失败"); return; }
    setUrl(null);
    if (reloadOnChange) window.location.reload();
  }

  return (
    <div className="surface-panel-subtle rounded-md p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-white">{label}</h2>
      </div>
      <div className="flex items-center gap-4">
        {preview}
        <div className="flex-1 space-y-2">
          <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
          <p className="text-xs text-slate-500">支持 jpg / png / webp / gif，最大 10MB</p>
          {uploading && <p className="text-xs text-blue-400">上传中...</p>}
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        {url && (
          <Button variant="ghost" onClick={handleRemove} className="text-xs text-slate-400 hover:text-red-400 shrink-0">
            清除
          </Button>
        )}
      </div>
    </div>
  );
}

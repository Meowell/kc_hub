"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/upload-client";

export function ImageUploader({
  label, icon, initialUrl, apiEndpoint, fieldName,
}: {
  label: string; icon: ReactNode; initialUrl: string | null;
  apiEndpoint: string; fieldName: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handleUpload(file: File) {
    setUploading(true); setErr("");
    try {
      const newUrl = await uploadImage(file);
      const patchRes = await fetch(apiEndpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [fieldName]: newUrl }),
      });
      if (!patchRes.ok) throw new Error("保存失败");
      setUrl(newUrl);
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
  }

  return (
    <div className="surface-panel-subtle rounded-md p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-white">{label}</h2>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {url ? (
          <Image src={url} alt={`${label}预览`} width={96} height={64} unoptimized className="h-16 w-24 rounded-md object-cover ring-1 ring-border-base" />
        ) : (
          <span className="flex h-16 w-24 items-center justify-center rounded-md border border-border-base bg-slate-900/60 text-xs text-slate-400">无背景</span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
          <p className="text-xs text-slate-500">支持 jpg / jpeg / png / webp / gif，最大 10MB</p>
          {uploading && <p role="status" className="text-sm text-blue-300">上传中…</p>}
          {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
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

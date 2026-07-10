"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/upload-client";

export function AvatarEditor({ initialAvatarUrl, userName }: { initialAvatarUrl: string | null; userName: string }) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handleUpload(file: File) {
    setUploading(true); setErr("");
    try {
      const url = await uploadImage(file);
      // save avatarUrl to user
      const patchRes = await fetch("/api/auth/avatar", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarUrl: url }),
      });
      if (!patchRes.ok) throw new Error("保存头像失败");
      setAvatarUrl(url);
    } catch (e) { setErr(e instanceof Error ? e.message : "上传失败"); }
    finally { setUploading(false); }
  }

  async function handleRemove() {
    setErr("");
    const res = await fetch("/api/auth/avatar", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ avatarUrl: null }),
    });
    if (!res.ok) { setErr("清除头像失败"); return; }
    setAvatarUrl(null);
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-6 shadow-lg shadow-black/10">
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-semibold text-white">个人头像</h2>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={userName} width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-500/50" />
        ) : (
          <span className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl font-bold text-blue-400 ring-2 ring-blue-500/30">
            {userName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); }} />
          <p className="text-xs text-slate-500">支持 jpg / jpeg / png / webp / gif，最大 10MB</p>
          {uploading && <p role="status" className="text-sm text-blue-300">上传中…</p>}
          {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        </div>
        {avatarUrl && (
          <Button variant="ghost" onClick={handleRemove} className="text-xs text-slate-400 hover:text-red-400 shrink-0">
            清除
          </Button>
        )}
      </div>
    </div>
  );
}

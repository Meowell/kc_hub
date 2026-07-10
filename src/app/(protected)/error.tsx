"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ProtectedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-md border border-red-500/35 bg-red-500/10 p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-300" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-white">页面暂时无法加载</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">数据没有被修改。请重试；如果问题持续，返回上一页后再进入。</p>
      <Button type="button" className="mt-5" onClick={reset}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />重试
      </Button>
    </div>
  );
}

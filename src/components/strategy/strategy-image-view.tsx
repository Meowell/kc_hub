"use client";

import { ImageOff, LoaderCircle } from "lucide-react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function sourceHost(source: string) {
  try {
    return new URL(source).hostname;
  } catch {
    return "外部来源";
  }
}

export function StrategyImageView({ node, selected, editor }: NodeViewProps) {
  const source = String(node.attrs.src ?? "");
  const uploadState = String(node.attrs.uploadState ?? "ready");
  const align = String(node.attrs.align ?? "center");
  const displayWidth = String(node.attrs.displayWidth ?? "auto");
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source]);

  return (
    <NodeViewWrapper
      as="figure"
      data-strategy-image-node=""
      data-align={align}
      data-display-width={displayWidth}
      data-upload-state={uploadState}
      className={cn("strategy-image-node", selected && "is-selected")}
      style={{ width: displayWidth === "auto" ? undefined : displayWidth }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={String(node.attrs.alt ?? "")}
          title={node.attrs.title ? String(node.attrs.title) : undefined}
          data-asset-id={node.attrs.assetId ? String(node.attrs.assetId) : undefined}
          data-upload-state={uploadState}
          data-align={align}
          className="strategy-editor-image"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="strategy-image-fallback" contentEditable={false}>
          <ImageOff className="h-6 w-6" aria-hidden="true" />
          <span className="font-semibold">图片无法读取</span>
          <span className="text-xs text-slate-500">
            {editor.isEditable ? "请删除后重新粘贴原图" : "请联系作者重新上传"} · {sourceHost(source)}
          </span>
        </div>
      )}
      {uploadState === "uploading" && (
        <span className="strategy-image-progress" contentEditable={false}>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在转存图片
        </span>
      )}
      {node.attrs.caption && <figcaption contentEditable={false}>{String(node.attrs.caption)}</figcaption>}
    </NodeViewWrapper>
  );
}

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Node, createAtomBlockMarkdownSpec, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { RoutineCardView } from "@/components/strategy/strategy-types";

const FleetEditor = dynamic(
  () => import("@/components/routine/fleet-editor").then((module) => module.FleetEditor),
  { ssr: false, loading: () => <p className="p-4 text-sm text-slate-500">正在加载阵容…</p> },
);

function RoutineCardNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const cardId = String(node.attrs.routineCardId ?? "");
  const displayMode = node.attrs.displayMode === "full" ? "full" : "compact";
  const expanded = editor.isEditable ? displayMode === "full" : true;
  const [card, setCard] = useState<RoutineCardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/routine?id=${encodeURIComponent(cardId)}&forStrategy=1`)
      .then(async (response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<{ record: RoutineCardView }>;
      })
      .then((payload) => {
        if (cancelled) return;
        setCard(payload.record);
        setMissing(false);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cardId]);

  if (loading) {
    return <NodeViewWrapper className="strategy-routine-node"><div className="strategy-routine-card text-slate-500">正在读取作业卡…</div></NodeViewWrapper>;
  }

  if (missing || !card) {
    return (
      <NodeViewWrapper className="strategy-routine-node">
        <div className="strategy-routine-card border-red-500/35 bg-red-950/20 text-red-200">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> 作业卡已不存在</span>
          {editor.isEditable && <div className="flex items-center gap-1"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("strategy:routine-replace", { detail: { replace: (routineCardId: string) => updateAttributes({ routineCardId, displayMode: "compact" }) } }))} className="icon-button" title="选择替换作业卡" aria-label="选择替换作业卡"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={deleteNode} className="icon-button" title="移除缺失卡片" aria-label="移除缺失卡片"><Trash2 className="h-4 w-4" /></button></div>}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="strategy-routine-node" data-expanded={expanded ? "true" : "false"} data-drag-handle>
      <div className={`strategy-routine-card${expanded ? " is-expanded" : ""}`}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sky-100">{card.seaArea} / {card.missionName}</p>
            <p className="mt-1 text-xs text-slate-400">{card.user.name} · 制空 {card.airControl}{card.note ? ` · ${card.note}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {editor.isEditable && (
              <>
                <button type="button" className="icon-button" title={displayMode === "full" ? "收起卡片" : "展开卡片"} onClick={() => updateAttributes({ displayMode: displayMode === "full" ? "compact" : "full" })}>
                  {displayMode === "full" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button type="button" className="icon-button" title="移除作业卡" onClick={deleteNode}><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </div>
        {expanded && (card.fleetData || card.imageUrl) && (
          <div className="mt-3 space-y-3 border-t border-slate-700/60 pt-3">
            {card.fleetData && (
              <FleetEditor
                shipData={null}
                initialFleetData={card.fleetData}
                readOnly
                title={`${card.seaArea} / ${card.missionName}`}
                onBack={editor.isEditable ? () => updateAttributes({ displayMode: "compact" }) : undefined}
                onFleetChange={() => {}}
              />
            )}
            {card.imageUrl && (
              <Image
                src={card.imageUrl}
                alt={`${card.seaArea} / ${card.missionName}`}
                width={1200}
                height={800}
                unoptimized
                className="h-auto max-h-[70vh] w-full rounded-md border border-slate-700/60 bg-slate-950 object-contain"
              />
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    routineCard: {
      insertRoutineCard: (options: { routineCardId: string; displayMode?: "compact" | "full" }) => ReturnType;
    };
  }
}

const routineCardMarkdown = createAtomBlockMarkdownSpec({
  nodeName: "routineCard",
  name: "routine-card",
  defaultAttributes: { displayMode: "compact" },
  requiredAttributes: ["routineCardId"],
  allowedAttributes: ["routineCardId", "displayMode"],
});

export const RoutineCardExtension = Node.create({
  ...routineCardMarkdown,
  name: "routineCard",
  group: "block",
  atom: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      routineCardId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-routine-card") ?? "",
        renderHTML: (attributes) => ({ "data-routine-card": attributes.routineCardId }),
      },
      displayMode: {
        default: "compact",
        parseHTML: (element) => element.getAttribute("data-display-mode") ?? "compact",
        renderHTML: (attributes) => ({ "data-display-mode": attributes.displayMode ?? "compact" }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-routine-card]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)];
  },

  addCommands() {
    return {
      insertRoutineCard: (options) => ({ commands }) => commands.insertContent({ type: this.name, attrs: options }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(RoutineCardNodeView);
  },
});

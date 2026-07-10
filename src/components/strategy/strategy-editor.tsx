"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Pencil, Trash2 } from "lucide-react";
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
const FleetEditor = dynamic(
  () => import("@/components/routine/fleet-editor").then((module) => module.FleetEditor),
  { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-slate-400">正在加载阵容预览…</p> },
);
import { createMasterLookup } from "@/lib/master-data";
import { createStrategyFormDefaults, filterRoutineCardsForInsert, STRATEGY_DEFAULT_TEMPLATE } from "@/lib/strategy-helpers";
import { uploadImage } from "@/lib/upload-client";
import { useMasterData } from "@/lib/use-master-data";
import { useDirtyForm } from "@/components/common/dirty-guard";

type Post = {
  id: string; phaseName: string; title: string; content: string;
  fleetImageUrl: string | null; airbaseImageUrl: string | null;
  routineCardIds: string | null;
  user: { id: string; name: string; avatarUrl: string | null };
  createdAt: Date | string;
};

type RoutineFull = {
  id: string; seaArea: string; missionName: string;
  airControl: number; note: string | null; imageUrl: string | null;
  fleetData: string | null; createdAt: string;
  user: { id: string; name: string };
};

type FleetShip = { name: string; level: number };
function parseFleetShips(fleetData: string, shipNameById: Map<number, string>): FleetShip[] {
  const result: FleetShip[] = [];
  try {
    const json = JSON.parse(fleetData);
    const f1 = json.f1;
    if (!f1) return result;
    for (let i = 1; i <= 6; i++) {
      const s = f1[`s${i}`];
      if (s && s.id) {
        result.push({ name: shipNameById.get(s.id) ?? `ID:${s.id}`, level: s.lv ?? 0 });
      }
    }
  } catch { /* ignore */ }
  return result;
}

/* ── Markdown renderer with custom tokens ── */

function renderMarkdown(
  content: string,
  routineById: Map<string, RoutineFull>,
  shipNameById: Map<number, string>,
  onToggleExpand: (id: string) => void,
  expandedCards: Set<string>,
): React.ReactNode {
  // Pre-process [img:url] and [card:id] into standard Markdown
  let processed = content;

  // Collect card tokens and replace with placeholders
  const cards: { id: string; placeholder: string }[] = [];
  processed = processed.replace(/\[card:([^\]]+)\]/g, (_, id) => {
    const placeholder = `[card-${id}]`;
    cards.push({ id, placeholder });
    return placeholder;
  });

  // Convert [img:url] to standard markdown image
  processed = processed.replace(/\[img:([^\]]+)\]/g, (_, url) => `![](${url})`);

  return (
    <ReactMarkdown
      components={{
        // Custom [card:id] placeholder → embedded FleetEditor card
        p: ({ children, ...props }) => {
          const text = typeof children === "string" ? children
            : Array.isArray(children) ? children.join("") : "";
          const parts = text.split(/\[card-([^\]]+)\]/g);
          if (parts.length === 1) {
            return <p {...props} className="text-sm text-slate-300 leading-7">{children}</p>;
          }
          const nodes: React.ReactNode[] = [];
          for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
              if (parts[i]) nodes.push(<span key={`t${i}`}>{parts[i]}</span>);
            } else {
              const cid = parts[i];
              const card = routineById.get(cid);
              if (card) {
                const fleet = card.fleetData ? parseFleetShips(card.fleetData, shipNameById) : [];
                const isExpanded = expandedCards.has(cid);
                nodes.push(
                  <span key={`c${i}`} className="inline-block align-middle not-prose my-1 rounded-lg border border-blue-500/20 bg-slate-800/60 w-full">
                    <button type="button" onClick={() => onToggleExpand(cid)}
                      className="w-full text-left p-2.5 hover:bg-blue-500/10 transition-colors flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-blue-400">{card.seaArea} / {card.missionName}</span>
                          <span className="text-[11px] text-slate-500">— {card.user.name}</span>
                        </div>
                        {fleet.length > 0 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            {fleet.map((s, j) => (
                              <span key={j} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] bg-slate-700/50 border border-slate-600/30 text-slate-300">
                                <span className="text-slate-500">Lv.{s.level}</span><span>{s.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 shrink-0 mt-0.5">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-blue-500/20">
                        <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-2 text-xs text-slate-500">
                          <span>制空 {card.airControl}</span>
                          {card.note && <><span>·</span><span>{card.note}</span></>}
                        </div>
                        <div className="p-2">
                          <FleetEditor shipData={null} initialFleetData={card.fleetData ?? undefined} readOnly={true}
                            title={`${card.seaArea} / ${card.missionName}`}
                            onBack={() => onToggleExpand(cid)} onFleetChange={() => {}} />
                        </div>
                      </div>
                    )}
                  </span>
                );
              }
            }
          }
          return <p {...props} className="text-sm text-slate-300 leading-7">{nodes}</p>;
        },
        img: ({ src, alt }) => src ? (
          <Image src={src} alt={alt ?? "截图"} width={1200} height={800} unoptimized className="my-2 h-auto max-w-full rounded-lg border border-slate-700/50" />
        ) : null,
        h1: ({ children }) => <h2 className="text-lg font-bold text-white mt-6 mb-2">{children}</h2>,
        h2: ({ children }) => <h3 className="text-base font-bold text-white mt-4 mb-1">{children}</h3>,
        h3: ({ children }) => <h4 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h4>,
        a: ({ children, href }) => <a href={href} className="text-blue-400 underline" target="_blank" rel="noopener">{children}</a>,
        code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-slate-700/50 text-xs text-amber-400">{children}</code>,
        ul: ({ children }) => <ul className="list-disc pl-5 text-sm text-slate-300 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-slate-300">{children}</li>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-500/50 pl-3 my-2 text-sm text-slate-400 italic">{children}</blockquote>,
        hr: () => <hr className="my-4 border-slate-700/50" />,
        pre: ({ children }) => <pre className="my-2 p-3 rounded-lg bg-slate-900/80 text-xs text-slate-300 overflow-x-auto">{children}</pre>,
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

/* ── Main component ── */

export function StrategyEditor({
  posts,
  currentUserId,
  routineCards,
  activityId,
}: {
  posts: Post[];
  currentUserId: string;
  routineCards: RoutineFull[];
  activityId: string | null;
}) {
  const router = useRouter();
  const { masterData } = useMasterData();
  const shipNameById = useMemo(
    () => createMasterLookup(masterData).shipNameById,
    [masterData],
  );
  const [f, setF] = useState(createStrategyFormDefaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [routineSearch, setRoutineSearch] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function toggleExpand(cid: string) {
    setExpandedCards((prev) => { const next = new Set(prev); if (next.has(cid)) next.delete(cid); else next.add(cid); return next; });
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = f.content.slice(0, start);
    const after = f.content.slice(end);
    const newContent = before + "\n" + text + "\n" + after;
    setF({ ...f, content: newContent });
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + text.length + 2; }, 0);
  }

  function handleUpload() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setErr("");
      try {
        const imageUrl = await uploadImage(file);
        insertAtCursor(`[img:${imageUrl}]`);
      } catch (error) {
        setErr(error instanceof Error ? error.message : "上传失败");
      }
    };
    input.click();
  }

  function insertCard(cardId: string) {
    insertAtCursor(`[card:${cardId}]`);
  }

  function insertTemplate() {
    if (!f.content.trim()) {
      setF({ ...f, content: STRATEGY_DEFAULT_TEMPLATE });
      return;
    }
    insertAtCursor(STRATEGY_DEFAULT_TEMPLATE.trim());
  }

  async function saveDraft() {
    if (submitting) return false;
    if (!f.phaseName.trim() || !f.title.trim() || !f.content.trim()) {
      setErr("请填写阶段、标题和攻略正文。");
      return false;
    }
    setErr("");
    setSubmitting(true);
    const method = editingId ? "PATCH" : "POST";
    const body = JSON.stringify({ ...f, id: editingId || undefined, activityId, fleetImageUrl: null, airbaseImageUrl: null, routineCardIds: null });
    try {
      const res = await fetch("/api/strategy", { method, headers: { "content-type": "application/json" }, body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "发布失败");
      setF(createStrategyFormDefaults()); setEditingId(null);
      setRoutineSearch("");
      setEditorOpen(false);
      router.refresh();
      return true;
    } catch (submitError) {
      setErr(submitError instanceof Error ? submitError.message : "发布失败，草稿已保留，请重试。");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void saveDraft();
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setF({ phaseName: post.phaseName, title: post.title, content: post.content });
    setErr("");
    setEditorOpen(true);
    setEditorTab("edit");
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function cancelEdit() { setEditingId(null); setF(createStrategyFormDefaults()); setErr(""); setRoutineSearch(""); setEditorOpen(false); }
  async function del(id: string) {
    setErr("");
    try {
      const response = await fetch(`/api/strategy?id=${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "删除失败");
      setPendingDeleteId(null);
      router.refresh();
    } catch (deleteError) {
      setPendingDeleteId(null);
      setErr(deleteError instanceof Error ? deleteError.message : "删除失败，请重试。");
    }
  }

  const grouped = useMemo(() => {
    const g: Record<string, Post[]> = {};
    for (const p of posts) (g[p.phaseName] ??= []).push(p);
    return g;
  }, [posts]);

  const routineById = useMemo(() => new Map(routineCards.map((r) => [r.id, r])), [routineCards]);
  const filteredRoutineCards = useMemo(
    () => filterRoutineCardsForInsert(routineCards, routineSearch),
    [routineCards, routineSearch],
  );
  useDirtyForm(editorOpen, saveDraft);

  return (
    <div>
      {!editorOpen && (
        <div className="mb-5 flex justify-end">
          <Button type="button" onClick={() => { setEditorOpen(true); setEditorTab("edit"); requestAnimationFrame(() => titleRef.current?.focus()); }}>
            新建攻略
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-6 xl:flex-row">
      {/* Editor */}
      {editorOpen && <div className="h-fit w-full shrink-0 rounded-md border border-slate-700/50 bg-slate-800/70 p-5 shadow-lg shadow-black/10 xl:sticky xl:top-24 xl:w-[min(44rem,52vw)]">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col gap-1 mb-1">
            <h2 className="text-lg font-semibold text-white">{editingId ? "编辑攻略" : "建立战术档案"}</h2>
            <p className="text-sm text-slate-400">{editingId ? "正在编辑已发布攻略，未保存内容会保留在本页。" : "填写阶段、标题和正文后发布。"}</p>
          </div>
          <Input value={f.phaseName} onChange={(e) => setF({ ...f, phaseName: e.target.value })} placeholder="阶段 (E2-3)" required />
          <Input ref={titleRef} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="标题" required />

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={handleUpload}
              className="py-2 text-sm rounded-sm bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors">
              插入截图
            </button>
            <button type="button" onClick={() => setShowRoutinePicker(!showRoutinePicker)}
              className="py-2 text-sm rounded-sm bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors">
              插入作业卡
            </button>
            <button type="button" onClick={insertTemplate}
              className="py-2 text-sm rounded-sm bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors">
              插入模板
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:hidden" role="tablist" aria-label="攻略编辑视图">
            <button type="button" role="tab" aria-selected={editorTab === "edit"} onClick={() => setEditorTab("edit")} className={editorTab === "edit" ? "min-h-11 rounded-md bg-primary/20 text-sky-100" : "min-h-11 rounded-md bg-slate-900/50 text-slate-300"}>编辑</button>
            <button type="button" role="tab" aria-selected={editorTab === "preview"} onClick={() => setEditorTab("preview")} className={editorTab === "preview" ? "min-h-11 rounded-md bg-primary/20 text-sky-100" : "min-h-11 rounded-md bg-slate-900/50 text-slate-300"}>预览</button>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <textarea ref={textareaRef} className={`${editorTab === "edit" ? "block" : "hidden"} min-h-72 w-full resize-y rounded-sm border border-slate-600 bg-slate-900/80 px-3 py-2 font-mono text-base text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-500/50 xl:block xl:text-sm`}
              value={f.content}
              onChange={(e) => setF({ ...f, content: e.target.value })}
              placeholder="使用 Markdown 编写攻略，可插入 [img:url] 与 [card:id]" />
            <Panel dense title="预览" status={<StatusBadge variant="muted">Markdown</StatusBadge>} className={`${editorTab === "preview" ? "block" : "hidden"} min-h-72 xl:block`}>
              <div className="max-h-80 overflow-y-auto pr-1">
                {f.content.trim() ? (
                  renderMarkdown(f.content, routineById, shipNameById, toggleExpand, expandedCards)
                ) : (
                  <p className="py-10 text-center text-sm text-slate-500">暂无预览内容</p>
                )}
              </div>
            </Panel>
          </div>

          {showRoutinePicker && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-900/50 p-2 space-y-1">
              <Input
                value={routineSearch}
                onChange={(e) => setRoutineSearch(e.target.value)}
                placeholder="搜索海域、任务、上传者"
                className="mb-2 h-8 text-xs"
              />
              {filteredRoutineCards.length === 0 && <p className="text-xs text-slate-500 p-2">无匹配作业卡</p>}
              {filteredRoutineCards.map((r) => (
                <button key={r.id} type="button" onClick={() => { insertCard(r.id); setShowRoutinePicker(false); }}
                  className="w-full text-left rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700/50 transition-colors">
                  {r.seaArea} / {r.missionName} <span className="text-slate-600">— {r.user.name}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-sm text-slate-400 leading-relaxed">
            支持 Markdown、截图 token 和作业卡 token，光标定位后点击上方按钮插入。
          </p>
          {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "保存中…" : editingId ? "保存" : "发布攻略"}</Button>
            <Button type="button" variant="ghost" onClick={cancelEdit} className="text-xs text-slate-300">取消</Button>
          </div>
        </form>
      </div>}

      {/* Posts */}
      <div className="flex-1 min-w-0 space-y-6">
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/40 py-16 text-center">
            <p className="text-slate-500">暂无攻略贴，发布第一条活动攻略吧</p>
          </div>
        ) : (
          Object.entries(grouped).map(([phase, phasePosts]) => (
            <div key={phase}>
              <div className="flex items-center gap-3 mb-3 sticky top-20 z-10 bg-slate-950/80 backdrop-blur-sm py-2 -mx-2 px-2">
                <span className="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-bold bg-blue-600 text-white">{phase}</span>
                <span className="text-xs text-slate-500">{phasePosts.length} 篇攻略</span>
              </div>
              <div className="space-y-4">
                {phasePosts.map((post) => {
                  const isOwner = post.user.id === currentUserId;
                  return (
                    <div key={post.id} className="rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-5 shadow-lg shadow-black/10 group hover:border-slate-600/50 transition-colors">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-2">
                          {post.user.avatarUrl ? <Image src={post.user.avatarUrl} alt={post.user.name} width={20} height={20} unoptimized className="h-5 w-5 rounded-full object-cover" /> : null}
                          <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="text-xs text-slate-500">{post.user.name} · {new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
                          {isOwner && (
                            <>
                              <button type="button" onClick={() => startEdit(post)} aria-label={`编辑${post.title}`} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-300 hover:bg-slate-700 hover:text-blue-300"><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => setPendingDeleteId(post.id)} aria-label={`删除${post.title}`} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-300 hover:bg-red-950/40 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {renderMarkdown(post.content, routineById, shipNameById, toggleExpand, expandedCards)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>删除这篇攻略？</AlertDialogTitle>
          <AlertDialogDescription>删除后无法恢复。网络失败时页面会保留并显示错误。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>取消</AlertDialogCancel>
          <AlertDialogAction variant="danger" onClick={() => pendingDeleteId && void del(pendingDeleteId)}>确认删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}

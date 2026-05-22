"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FleetEditor } from "@/components/routine/fleet-editor";
import start2 from "@/data/START2.json";

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
function parseFleetShips(fleetData: string): FleetShip[] {
  const result: FleetShip[] = [];
  try {
    const json = JSON.parse(fleetData);
    const f1 = json.f1;
    if (!f1) return result;
    for (let i = 1; i <= 6; i++) {
      const s = f1[`s${i}`];
      if (s && s.id) {
        const master = (start2.api_mst_ship as Array<{ api_id: number; api_name: string }>).find((m) => m.api_id === s.id);
        result.push({ name: master?.api_name ?? `ID:${s.id}`, level: s.lv ?? 0 });
      }
    }
  } catch { /* ignore */ }
  return result;
}

/* ── Markdown renderer with custom tokens ── */

function renderMarkdown(
  content: string,
  routineById: Map<string, RoutineFull>,
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
                const fleet = card.fleetData ? parseFleetShips(card.fleetData) : [];
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
        img: ({ src, alt }) => (
          <img src={src} alt={alt ?? "截图"} className="my-2 max-w-full rounded-lg border border-slate-700/50" />
        ),
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

export function StrategyEditor({ posts, currentUserId, routineCards }: { posts: Post[]; currentUserId: string; routineCards: RoutineFull[] }) {
  const router = useRouter();
  const emptyForm = { phaseName: "", title: "", content: "" };
  const [f, setF] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const data = new FormData(); data.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const p = await res.json();
      if (!res.ok) { setErr(p.error ?? "上传失败"); return; }
      insertAtCursor(`[img:${p.imageUrl}]`);
    };
    input.click();
  }

  function insertCard(cardId: string) {
    insertAtCursor(`[card:${cardId}]`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    const method = editingId ? "PATCH" : "POST";
    const body = JSON.stringify({ ...f, id: editingId || undefined, fleetImageUrl: null, airbaseImageUrl: null, routineCardIds: null });
    const res = await fetch("/api/strategy", { method, headers: { "content-type": "application/json" }, body });
    const d = await res.json();
    if (!res.ok) { setErr(d.error ?? "发布失败"); return; }
    setF(emptyForm); setEditingId(null);
    router.refresh();
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setF({ phaseName: post.phaseName, title: post.title, content: post.content });
    setErr("");
  }

  function cancelEdit() { setEditingId(null); setF(emptyForm); setErr(""); }
  async function del(id: string) { await fetch(`/api/strategy?id=${id}`, { method: "DELETE" }); router.refresh(); }

  const grouped = useMemo(() => {
    const g: Record<string, Post[]> = {};
    for (const p of posts) (g[p.phaseName] ??= []).push(p);
    return g;
  }, [posts]);

  const routineById = useMemo(() => new Map(routineCards.map((r) => [r.id, r])), [routineCards]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Editor */}
      <div className="w-full lg:w-96 shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-6 shadow-lg shadow-black/10 h-fit lg:sticky lg:top-24">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📝</span>
            <h2 className="text-lg font-semibold text-white">{editingId ? "编辑攻略" : "发布攻略"}</h2>
          </div>
          <Input value={f.phaseName} onChange={(e) => setF({ ...f, phaseName: e.target.value })} placeholder="阶段 (E2-3)" required />
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="标题" required />

          <div className="flex gap-2">
            <button type="button" onClick={handleUpload}
              className="flex-1 py-2 text-sm rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors">
              📸 插入截图
            </button>
            <button type="button" onClick={() => setShowRoutinePicker(!showRoutinePicker)}
              className="flex-1 py-2 text-sm rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors">
              📋 插入阵容
            </button>
          </div>

          <textarea ref={textareaRef} className="min-h-44 font-mono text-sm rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 px-3 py-2 w-full outline-none focus:border-blue-500/50 placeholder:text-slate-600 resize-y"
            value={f.content}
            onChange={(e) => setF({ ...f, content: e.target.value })}
            placeholder={`## 路线\nE2-3 上路最短\n\n## 配装\n- 战列舰：主主彻侦\n- 空母：舰战×4\n\n支持完整 Markdown 语法，# ## ### 标题 **粗体** *斜体* [链接](url)\n> 引用 - 列表 1. 有序列表 \`代码\` 等\n\n📸 点击「插入截图」📋 点击「插入阵容」`} />

          {showRoutinePicker && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-900/50 p-2 space-y-1">
              {routineCards.length === 0 && <p className="text-xs text-slate-500 p-2">暂无周回记录</p>}
              {routineCards.map((r) => (
                <button key={r.id} type="button" onClick={() => { insertCard(r.id); setShowRoutinePicker(false); }}
                  className="w-full text-left rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700/50 transition-colors">
                  {r.seaArea} / {r.missionName} <span className="text-slate-600">— {r.user.name}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-600 leading-relaxed">
            💡 支持 Markdown 语法，光标定位后点击按钮插入。
          </p>
          {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{editingId ? "💾 保存" : "📢 发布攻略"}</Button>
            {editingId && <Button type="button" variant="ghost" onClick={cancelEdit} className="text-xs text-slate-400">取消</Button>}
          </div>
        </form>
      </div>

      {/* Posts */}
      <div className="flex-1 min-w-0 space-y-6">
        {posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/40 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {post.user.avatarUrl ? <img src={post.user.avatarUrl} alt={post.user.name} className="w-5 h-5 rounded-full object-cover" /> : null}
                          <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-all">
                          <span className="text-xs text-slate-500">{post.user.name} · {new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
                          {isOwner && (
                            <>
                              <button type="button" onClick={() => startEdit(post)} className="text-slate-500 hover:text-blue-400 text-xs">✏️</button>
                              <button type="button" onClick={() => del(post.id)} className="text-slate-500 hover:text-red-400 text-xs">🗑️</button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {renderMarkdown(post.content, routineById, toggleExpand, expandedCards)}
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
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronRight, Copy, History, LockKeyhole, Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RichStrategyEditor } from "@/components/strategy/rich-strategy-editor";
import { StrategyStructureManager } from "@/components/strategy/strategy-structure-manager";
import { useDirtyForm } from "@/components/common/dirty-guard";
import type {
  StrategyLockTag,
  StrategyMapView,
  StrategyPostView,
  StrategySectionView,
} from "@/components/strategy/strategy-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLockTagColorClassName, getLockTagColorStyle, isCustomLockTagColor } from "@/lib/lock-tag-colors";
import { EMPTY_STRATEGY_DOCUMENT, STRATEGY_CONTENT_FORMAT } from "@/lib/strategy-workspace";
import { cn } from "@/lib/utils";

type SavePayload = { content: string; plainText: string; hasPendingUploads: boolean };
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

function StrategyPostDocument({ post: initialPost, editable, activityId, onDeleted }: {
  post: StrategyPostView;
  editable: boolean;
  activityId: string;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [payload, setPayload] = useState<SavePayload>({ content: initialPost.content, plainText: initialPost.plainText, hasPendingUploads: false });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<Array<{ id: string; revision: number; createdAt: string; createdBy: { name: string } }>>([]);
  const savingRef = useRef(false);
  const lastSavedContentRef = useRef(initialPost.content);

  useEffect(() => {
    setPost(initialPost);
    setPayload({ content: initialPost.content, plainText: initialPost.plainText, hasPendingUploads: false });
    lastSavedContentRef.current = initialPost.content;
    setSaveState("idle");
  }, [initialPost]);

  const save = useCallback(async (nextStatus?: "published") => {
    if (!editable || savingRef.current || saveState === "conflict") return false;
    if (payload.hasPendingUploads) {
      setSaveError("仍有图片正在上传或上传失败，请处理后再离开。");
      return false;
    }
    savingRef.current = true;
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch("/api/strategy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          activityId,
          sectionId: post.sectionId,
          phaseName: post.phaseName,
          title: post.title,
          content: payload.content,
          contentFormat: STRATEGY_CONTENT_FORMAT,
          plainText: payload.plainText,
          revision: post.revision,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setSaveState("conflict");
        setSaveError("攻略已在其他页面更新。当前本地内容仍保留，请复制后刷新。");
        return false;
      }
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      const updated = {
        ...post,
        ...data.post,
        createdAt: new Date(data.post.createdAt).toISOString(),
        updatedAt: new Date(data.post.updatedAt).toISOString(),
        publishedAt: data.post.publishedAt ? new Date(data.post.publishedAt).toISOString() : null,
      } as StrategyPostView;
      setPost(updated);
      lastSavedContentRef.current = payload.content;
      setSaveState("saved");
      if (nextStatus) router.refresh();
      return true;
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "保存失败");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [activityId, editable, payload, post, router, saveState]);

  useDirtyForm(
    editable && (payload.hasPendingUploads || payload.content !== lastSavedContentRef.current),
    () => save(),
  );

  useEffect(() => {
    if (!editable || payload.hasPendingUploads || payload.content === lastSavedContentRef.current || saveState === "conflict") return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [editable, payload.content, payload.hasPendingUploads, save, saveState]);

  async function publish() {
    if (payload.hasPendingUploads) {
      setSaveError("仍有图片正在上传或上传失败，处理后才能发布。");
      return;
    }
    await save("published");
  }

  async function copyLocalDraft() {
    try {
      await navigator.clipboard.writeText(payload.content);
      setSaveError("本地结构化副本已复制，可刷新后重新粘贴或导入。");
    } catch {
      setSaveError("浏览器未允许写入剪贴板，请先保持当前页面不要刷新。");
    }
  }

  async function remove() {
    if (!window.confirm("删除这篇个人攻略？删除后可在该分块重新创建。")) return;
    const response = await fetch(`/api/strategy?id=${encodeURIComponent(post.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setSaveError(data.error ?? "删除失败");
      return;
    }
    onDeleted();
    router.refresh();
  }

  async function loadHistory() {
    setHistoryOpen(true);
    const response = await fetch(`/api/strategy/revisions?postId=${encodeURIComponent(post.id)}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) setRevisions(data.revisions ?? []);
  }

  async function restoreRevision(revisionId: string) {
    const response = await fetch("/api/strategy/revisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id, revisionId, currentRevision: post.revision }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveError(data.error ?? "恢复失败");
      return;
    }
    setHistoryOpen(false);
    window.location.reload();
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-700/60 pb-3">
        <span className={cn("status-badge", post.status === "published" ? "text-emerald-300" : "text-amber-300")}>{post.status === "published" ? "已发布" : "草稿"}</span>
        {editable && <span className="text-xs text-slate-500">{payload.hasPendingUploads ? "处理图片后保存" : saveState === "saving" ? "保存中…" : saveState === "saved" ? "已自动保存" : saveState === "error" ? "保存失败" : saveState === "conflict" ? "版本冲突" : "自动保存"}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {editable && post.status === "draft" && <Button type="button" disabled={saveState === "saving" || payload.hasPendingUploads} onClick={() => void publish()}><Send className="h-4 w-4" /> 发布</Button>}
          {editable && <Button type="button" variant="ghost" title="历史版本" disabled={payload.hasPendingUploads} onClick={() => void loadHistory()}><History className="h-4 w-4" /></Button>}
          {editable && <Button type="button" variant="ghost" title="删除攻略" disabled={payload.hasPendingUploads} onClick={() => void remove()}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      {saveError && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md border border-red-500/35 bg-red-950/20 p-3 text-sm text-red-200">
          <span>{saveError}</span>
          {saveState === "conflict" && <div className="flex shrink-0 gap-2"><Button type="button" variant="secondary" onClick={() => void copyLocalDraft()}><Copy className="h-4 w-4" /> 复制本地副本</Button><Button type="button" variant="secondary" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" /> 重新载入</Button></div>}
        </div>
      )}
      <RichStrategyEditor post={post} editable={editable} activityId={activityId} onChange={editable ? setPayload : undefined} />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>历史版本</DialogTitle><DialogDescription>恢复前会自动保存当前版本。</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {revisions.map((revision) => (
              <div key={revision.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-700 p-3">
                <div><p className="text-sm text-slate-100">版本 {revision.revision}</p><p className="text-xs text-slate-500">{revision.createdBy.name} · {new Date(revision.createdAt).toLocaleString("zh-CN")}</p></div>
                <Button type="button" variant="secondary" onClick={() => void restoreRevision(revision.id)}>恢复</Button>
              </div>
            ))}
            {revisions.length === 0 && <p className="py-8 text-center text-sm text-slate-500">暂无历史版本</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StrategyWorkspace({
  activityId,
  maps,
  lockTags,
  legacyPosts,
  currentUserId,
  canManage,
  activityWritable,
}: {
  activityId: string;
  maps: StrategyMapView[];
  lockTags: StrategyLockTag[];
  legacyPosts: StrategyPostView[];
  currentUserId: string;
  canManage: boolean;
  activityWritable: boolean;
}) {
  const router = useRouter();
  const activeMaps = useMemo(() => maps.filter((map) => !map.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder), [maps]);
  const firstSectionId = activeMaps.flatMap((map) => map.sections.filter((section) => !section.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder))[0]?.id ?? null;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(firstSectionId);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedLegacyPostId, setSelectedLegacyPostId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedLegacyPostId) return;
    if (!selectedSectionId || !activeMaps.some((map) => map.sections.some((section) => section.id === selectedSectionId && !section.isDeleted))) {
      setSelectedSectionId(firstSectionId);
    }
  }, [activeMaps, firstSectionId, selectedLegacyPostId, selectedSectionId]);

  const selectedMap = activeMaps.find((map) => map.sections.some((section) => section.id === selectedSectionId)) ?? null;
  const selectedSection = selectedMap?.sections.find((section) => section.id === selectedSectionId) ?? null;
  const visiblePosts = useMemo(() => {
    if (!selectedSection) return [];
    return [...selectedSection.posts]
      .filter((post) => !post.isDeleted && (post.status === "published" || post.userId === currentUserId))
      .sort((a, b) => a.userId === currentUserId ? -1 : b.userId === currentUserId ? 1 : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [currentUserId, selectedSection]);
  const ownPost = visiblePosts.find((post) => post.userId === currentUserId) ?? null;

  useEffect(() => {
    if (selectedPostId && visiblePosts.some((post) => post.id === selectedPostId)) return;
    setSelectedPostId(ownPost?.id ?? visiblePosts[0]?.id ?? null);
  }, [ownPost?.id, selectedPostId, selectedSectionId, visiblePosts]);
  const selectedPost = visiblePosts.find((post) => post.id === selectedPostId) ?? null;
  const selectedLegacyPost = legacyPosts.find((post) => post.id === selectedLegacyPostId) ?? null;
  const selectedMapWritable = Boolean(activityWritable && selectedMap?.isOpenForPosts);

  async function createMyPost() {
    if (!selectedSection || !selectedMap) return;
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          activityId,
          sectionId: selectedSection.id,
          phaseName: selectedMap.code,
          title: `${selectedMap.code} ${selectedSection.name}`,
          content: JSON.stringify(EMPTY_STRATEGY_DOCUMENT),
          contentFormat: STRATEGY_CONTENT_FORMAT,
          plainText: "",
          status: "draft",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "创建攻略失败");
      setSelectedPostId(data.post.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建攻略失败");
    } finally { setCreating(false); }
  }

  async function moveLegacyPost(postId: string) {
    if (!selectedSection) {
      setError("先选择目标攻略分块，再移动旧攻略。");
      return;
    }
    if (!window.confirm(`将旧攻略移动到当前分块“${selectedMap?.code} ${selectedSection.name}”？`)) return;
    const response = await fetch("/api/strategy/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, sectionId: selectedSection.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "移动攻略失败");
      return;
    }
    setSelectedLegacyPostId(null);
    setSelectedPostId(data.post.id);
    router.refresh();
  }

  return (
    <div className="strategy-workspace-grid">
      {canManage && activityWritable && <div className="strategy-manager-dock"><StrategyStructureManager activityId={activityId} initialMaps={maps} lockTags={lockTags} /></div>}
      <aside className="strategy-outline-panel">
        <div className="border-b border-slate-700/60 p-3">
          <p className="terminal-label text-[10px] font-semibold text-primary">GUIDE STRUCTURE</p>
          <p className="mt-1 text-sm font-semibold text-white">活动攻略分块</p>
        </div>
        <nav className="max-h-[calc(100dvh-13rem)] overflow-y-auto p-2" aria-label="攻略分块目录">
          {activeMaps.map((map) => (
            <div key={map.id} className="mb-3">
              <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-300">
                <span>{map.code}</span>
                <span className={activityWritable && map.isOpenForPosts ? "text-emerald-400" : "text-amber-400"}>{activityWritable ? map.isOpenForPosts ? "开放" : "整理中" : "只读"}</span>
              </div>
              <div className="space-y-1">
                {map.sections.filter((section) => !section.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder).map((section) => {
                  const guideCount = section.posts.filter((post) => post.status === "published" && !post.isDeleted).length;
                  const isSelected = !selectedLegacyPostId && selectedSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      data-has-guides={guideCount > 0 ? "true" : "false"}
                      onClick={() => { setSelectedLegacyPostId(null); setSelectedSectionId(section.id); setSelectedPostId(null); }}
                      className={cn(
                        "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "border-sky-500/60 bg-sky-950/35 text-sky-100 shadow-sm"
                          : guideCount > 0
                            ? "border-slate-600/80 bg-slate-800/55 text-slate-200 shadow-sm hover:border-sky-500/55 hover:bg-sky-950/30 hover:text-sky-100"
                            : "border-transparent text-slate-500 hover:bg-slate-800/45 hover:text-slate-300",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{map.code} {section.name}</span>
                        {guideCount > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />}
                      </span>
                      <span className={cn("mt-1 block text-[10px]", guideCount > 0 ? "text-sky-300/80" : "text-slate-600")}>{guideCount} 篇攻略</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {activeMaps.length === 0 && <p className="px-2 py-8 text-center text-xs text-slate-500">活动分块尚未建立</p>}
          {legacyPosts.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <p className="px-2 text-xs font-semibold text-slate-500">未分块旧攻略</p>
              {legacyPosts.map((post) => (
                <div key={post.id} className="group flex items-center gap-1 px-1 py-1">
                  <button type="button" onClick={() => { setSelectedLegacyPostId(post.id); setSelectedPostId(null); }} className={cn("min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-xs", selectedLegacyPostId === post.id ? "bg-sky-950/35 text-sky-200" : "text-slate-500 hover:text-slate-200")}>{post.phaseName} · {post.title}</button>
                  {canManage && activityWritable && selectedSection && <button type="button" title="移到当前分块" onClick={() => void moveLegacyPost(post.id)} className="rounded p-1 text-slate-600 opacity-0 hover:bg-slate-800 hover:text-sky-300 group-hover:opacity-100"><Archive className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <main className="strategy-document-panel">
        {selectedLegacyPost ? (
          <>
            <header className="border-b border-slate-700/60 px-4 py-4 sm:px-5">
              <p className="terminal-label text-[10px] text-amber-400">LEGACY / 未分块攻略</p>
              <h2 className="mt-1 text-xl font-bold text-white">{selectedLegacyPost.phaseName} · {selectedLegacyPost.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{selectedLegacyPost.user.name} · 管理员可将此攻略移入选定的公共分块</p>
            </header>
            <div className="p-3 sm:p-5">
              <StrategyPostDocument post={selectedLegacyPost} editable={false} activityId={activityId} onDeleted={() => setSelectedLegacyPostId(null)} />
            </div>
          </>
        ) : selectedSection && selectedMap ? (
          <>
            <header className="border-b border-slate-700/60 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="terminal-label text-[10px] text-primary">{selectedMap.code} / SECTION {selectedSection.sortOrder + 1}</p>
                  <h2 className="mt-1 text-xl font-bold text-white">{selectedMap.code} {selectedSection.name}</h2>
                </div>
                {!selectedMapWritable && <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-950/20 px-2.5 py-1 text-xs text-amber-200"><LockKeyhole className="h-3.5 w-3.5" /> {activityWritable ? "海图整理中" : "活动已归档"}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSection.lockTags.map(({ lockTag }) => {
                  const className = cn("rounded-md px-2 py-1 text-xs font-semibold", getLockTagColorClassName(lockTag.colorClass), !isCustomLockTagColor(lockTag.colorClass) && "text-slate-900", !lockTag.isActive && "grayscale opacity-60");
                  return lockTag.isActive
                    ? <Link key={lockTag.id} href={`/lock-plan?activityId=${encodeURIComponent(activityId)}&tagId=${encodeURIComponent(lockTag.id)}`} className={className} style={getLockTagColorStyle(lockTag.colorClass)}>{lockTag.name}</Link>
                    : <span key={lockTag.id} className={className} style={getLockTagColorStyle(lockTag.colorClass)} title="贴条已停用">{lockTag.name}（停用）</span>;
                })}
                {selectedSection.lockTags.length === 0 && <span className="text-xs text-slate-600">未绑定锁船贴条</span>}
              </div>
            </header>
            <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-700/60 px-3 py-2">
              {visiblePosts.map((post) => (
                <button key={post.id} type="button" onClick={() => setSelectedPostId(post.id)} className={cn("inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs", selectedPostId === post.id ? "border-sky-500/50 bg-sky-950/30 text-sky-100" : "border-slate-700 text-slate-400 hover:text-slate-100")}>
                  {post.user.avatarUrl && <Image src={post.user.avatarUrl} alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded-sm object-cover" />}
                  {post.userId === currentUserId ? "我的攻略" : post.user.name}
                  {post.status === "draft" && <span className="text-amber-400">草稿</span>}
                </button>
              ))}
              {!ownPost && selectedMapWritable && <Button type="button" variant="secondary" className="shrink-0" disabled={creating} onClick={() => void createMyPost()}><Plus className="h-4 w-4" /> {creating ? "创建中…" : "写我的攻略"}</Button>}
            </div>
            {error && <p className="m-4 rounded-md border border-red-500/35 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
            <div className="p-3 sm:p-5">
              {selectedPost ? (
                <StrategyPostDocument
                  key={selectedPost.id}
                  post={selectedPost}
                  editable={selectedMapWritable && selectedPost.userId === currentUserId}
                  activityId={activityId}
                  onDeleted={() => setSelectedPostId(null)}
                />
              ) : (
                <div className="grid min-h-80 place-items-center text-center">
                  <div>{selectedMapWritable ? <Pencil className="mx-auto h-8 w-8 text-slate-700" /> : <LockKeyhole className="mx-auto h-8 w-8 text-slate-700" />}<p className="mt-3 text-sm text-slate-500">{selectedMapWritable ? "这个分块还没有个人攻略" : activityWritable ? "海图开放投稿后即可开始编写" : "活动归档期间攻略统一只读"}</p></div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid min-h-[32rem] place-items-center text-center"><div><Archive className="mx-auto h-10 w-10 text-slate-700" /><p className="mt-3 text-sm text-slate-500">选择攻略分块开始查看</p></div></div>
        )}
      </main>
    </div>
  );
}

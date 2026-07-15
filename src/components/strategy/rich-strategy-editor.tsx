"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns2,
  Columns3,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquareWarning,
  Redo2,
  RefreshCw,
  RemoveFormatting,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  columnsContent,
  createStrategyExtensions,
} from "@/components/strategy/strategy-extensions";
import type { RoutineCardView, StrategyPostView } from "@/components/strategy/strategy-types";
import { extractStrategyPlainText, parseStrategyDocument } from "@/lib/strategy-workspace";
import { cn } from "@/lib/utils";

type SavePayload = {
  content: string;
  plainText: string;
  hasPendingUploads: boolean;
};

type AssetResponse = {
  asset?: { id: string; url: string };
  error?: string;
};

function editorContent(post: StrategyPostView) {
  if (post.contentFormat === "tiptap-json-v1") return parseStrategyDocument(post.content);
  return post.content
    .replace(/\[img:([^\]]+)\]/g, "![]($1)")
    .replace(/\[card:([^\]]+)\]/g, '<div data-routine-card="$1" data-display-mode="compact"></div>');
}

function isExternalImageSource(source: string) {
  return /^https?:\/\//i.test(source);
}

function updateImageBySource(editor: Editor, source: string, attributes: Record<string, unknown>) {
  let found = false;
  const transaction = editor.state.tr;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "image" || node.attrs.src !== source) return;
    transaction.setNodeMarkup(position, undefined, { ...node.attrs, ...attributes });
    found = true;
  });
  if (found) editor.view.dispatch(transaction);
  return found;
}

function ToolbarButton({ active, title, onClick, children, disabled }: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`strategy-tool-button ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

export function RichStrategyEditor({
  post,
  editable,
  activityId,
  onChange,
}: {
  post: StrategyPostView;
  editable: boolean;
  activityId: string | null;
  onChange?: (payload: SavePayload) => void;
}) {
  const editorRef = useRef<Editor | null>(null);
  const handleFilesRef = useRef<(files: File[]) => void>(() => {});
  const handleExternalImagesRef = useRef<(editor: Editor) => void>(() => {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const failedUploadsRef = useRef(new Map<string, File>());
  const activeExternalUploadsRef = useRef(new Set<string>());
  const failedExternalUploadsRef = useRef(new Set<string>());
  const postIdRef = useRef(post.id);
  const [assetPanel, setAssetPanel] = useState<"images" | "cards" | "markdown">("cards");
  const [routineQuery, setRoutineQuery] = useState("");
  const [routineCards, setRoutineCards] = useState<RoutineCardView[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [routinePage, setRoutinePage] = useState(1);
  const [routineTotalPages, setRoutineTotalPages] = useState(1);
  const [routineReplacement, setRoutineReplacement] = useState<((routineCardId: string) => void) | null>(null);
  const [markdownInput, setMarkdownInput] = useState("");
  const [uploadError, setUploadError] = useState("");

  postIdRef.current = post.id;

  useEffect(() => () => {
    for (const source of failedUploadsRef.current.keys()) URL.revokeObjectURL(source);
  }, []);

  useEffect(() => {
    function handleReplacement(event: Event) {
      const replace = (event as CustomEvent<{ replace?: (routineCardId: string) => void }>).detail?.replace;
      if (!replace) return;
      setRoutineReplacement(() => replace);
      setAssetPanel("cards");
    }
    window.addEventListener("strategy:routine-replace", handleReplacement);
    return () => window.removeEventListener("strategy:routine-replace", handleReplacement);
  }, []);

  useEffect(() => setRoutineReplacement(null), [post.id]);

  const extensions = useMemo(() => createStrategyExtensions({
    onPasteFiles(files) { handleFilesRef.current(files); },
  }), []);

  const emitChange = useCallback((instance: Editor) => {
    if (!onChange) return;
    const json = instance.getJSON();
    let hasPendingUploads = false;
    instance.state.doc.descendants((node) => {
      if (node.type.name !== "image") return;
      const source = String(node.attrs.src ?? "");
      if (node.attrs.uploadState !== "ready" || (isExternalImageSource(source) && !node.attrs.assetId)) {
        hasPendingUploads = true;
      }
    });
    onChange({
      content: JSON.stringify(json),
      plainText: extractStrategyPlainText(json),
      hasPendingUploads,
    });
  }, [onChange]);

  const editor = useEditor({
    extensions,
    content: editorContent(post),
    contentType: post.contentFormat === "markdown" ? "markdown" : "json",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": editable ? "攻略正文编辑器" : "攻略正文",
      },
    },
    onCreate({ editor: instance }) {
      editorRef.current = instance;
      queueMicrotask(() => {
        if (!instance.isDestroyed) handleExternalImagesRef.current(instance);
      });
    },
    onUpdate({ editor: instance }) {
      emitChange(instance);
      queueMicrotask(() => {
        if (!instance.isDestroyed) handleExternalImagesRef.current(instance);
      });
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    editor?.setEditable(editable);
  }, [editable, editor]);

  const uploadOne = useCallback(async (file: File, temporarySource: string) => {
    setUploadError("");
    try {
      const body = new FormData();
      body.append("postId", post.id);
      body.append("file", file);
      const response = await fetch("/api/strategy/assets", { method: "POST", body });
      const payload = await response.json().catch(() => ({})) as AssetResponse;
      if (!response.ok || !payload.asset) throw new Error(payload.error ?? `上传失败（HTTP ${response.status}）`);
      const attached = editorRef.current ? updateImageBySource(editorRef.current, temporarySource, {
          src: payload.asset.url,
          assetId: payload.asset.id,
          uploadState: "ready",
        }) : false;
      if (!attached) {
        await fetch(`/api/strategy/assets?id=${encodeURIComponent(payload.asset.id)}&orphan=1`, { method: "DELETE" });
      }
      failedUploadsRef.current.delete(temporarySource);
      URL.revokeObjectURL(temporarySource);
    } catch (error) {
      failedUploadsRef.current.set(temporarySource, file);
      if (editorRef.current) updateImageBySource(editorRef.current, temporarySource, { uploadState: "error" });
      setUploadError(error instanceof Error ? error.message : "图片上传失败");
    }
  }, [post.id]);

  const importExternalImage = useCallback(async (source: string) => {
    const instance = editorRef.current;
    if (!instance || !editable || activeExternalUploadsRef.current.has(source) || failedExternalUploadsRef.current.has(source)) return;
    activeExternalUploadsRef.current.add(source);
    updateImageBySource(instance, source, { uploadState: "uploading" });
    setUploadError("");
    const sourcePostId = post.id;
    try {
      const response = await fetch("/api/strategy/assets/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: sourcePostId, url: source }),
      });
      const payload = await response.json().catch(() => ({})) as AssetResponse;
      if (!response.ok || !payload.asset) throw new Error(payload.error ?? `外部图片转存失败（HTTP ${response.status}）`);
      if (postIdRef.current !== sourcePostId || !editorRef.current) {
        await fetch(`/api/strategy/assets?id=${encodeURIComponent(payload.asset.id)}&orphan=1`, { method: "DELETE" });
        return;
      }
      const attached = updateImageBySource(editorRef.current, source, {
        src: payload.asset.url,
        assetId: payload.asset.id,
        uploadState: "ready",
      });
      if (!attached) {
        await fetch(`/api/strategy/assets?id=${encodeURIComponent(payload.asset.id)}&orphan=1`, { method: "DELETE" });
      }
      failedExternalUploadsRef.current.delete(source);
    } catch (error) {
      failedExternalUploadsRef.current.add(source);
      if (postIdRef.current === sourcePostId && editorRef.current) {
        updateImageBySource(editorRef.current, source, { uploadState: "error" });
        const isKdocs = /(^|\.)kdocs\.cn$/i.test((() => {
          try { return new URL(source).hostname; } catch { return ""; }
        })());
        setUploadError(isKdocs
          ? "金山文档的临时图片需要登录，无法作为攻略图片保存。请删除裂图，并在金山文档中单独复制原图后重新粘贴。"
          : error instanceof Error ? error.message : "外部图片转存失败，请重新粘贴原图。");
      }
    } finally {
      activeExternalUploadsRef.current.delete(source);
    }
  }, [editable, post.id]);

  const queueExternalImages = useCallback((instance: Editor) => {
    const sources = new Set<string>();
    instance.state.doc.descendants((node) => {
      const source = node.type.name === "image" ? String(node.attrs.src ?? "") : "";
      if (source && isExternalImageSource(source) && !node.attrs.assetId) sources.add(source);
    });
    for (const source of sources) void importExternalImage(source);
  }, [importExternalImage]);
  handleExternalImagesRef.current = queueExternalImages;

  useEffect(() => {
    activeExternalUploadsRef.current.clear();
    failedExternalUploadsRef.current.clear();
    setUploadError("");
  }, [post.id]);

  useEffect(() => {
    if (editor && editable) queueExternalImages(editor);
  }, [editable, editor, queueExternalImages]);

  const insertFiles = useCallback((files: File[]) => {
    const instance = editorRef.current;
    const supported = files.filter((file) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type));
    if (!instance || !editable || supported.length === 0) return;
    const entries = supported.map((file) => ({ file, source: URL.createObjectURL(file) }));
    const blocks: JSONContent[] = entries.length === 1
      ? [{ type: "image", attrs: { src: entries[0].source, uploadState: "uploading", align: "center" } }]
      : [{
        type: "strategyColumns",
        attrs: { count: 2 },
        content: entries.map((entry) => ({
          type: "strategyColumn",
          content: [{ type: "image", attrs: { src: entry.source, uploadState: "uploading", align: "center" } }],
        })),
      }];
    instance.chain().focus().insertContent(blocks).run();
    for (const entry of entries) void uploadOne(entry.file, entry.source);
  }, [editable, uploadOne]);
  handleFilesRef.current = insertFiles;

  useEffect(() => {
    if (!editable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRoutineLoading(true);
      const params = new URLSearchParams({ forStrategy: "1", pageSize: "20", page: String(routinePage), q: routineQuery });
      if (activityId) params.set("activityId", activityId);
      try {
        const response = await fetch(`/api/routine?${params}`, { signal: controller.signal });
        const payload = await response.json() as { records?: RoutineCardView[]; pagination?: { totalPages?: number } };
        if (response.ok) {
          setRoutineCards(payload.records ?? []);
          setRoutineTotalPages(Math.max(1, payload.pagination?.totalPages ?? 1));
        }
      } catch {
        if (!controller.signal.aborted) setRoutineCards([]);
      } finally {
        if (!controller.signal.aborted) setRoutineLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activityId, editable, routinePage, routineQuery]);

  useEffect(() => setRoutinePage(1), [activityId, routineQuery]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => instance ? ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      imageError: instance.isActive("image", { uploadState: "error" }),
      image: instance.isActive("image"),
      imageWidth: String(instance.getAttributes("image").displayWidth ?? "auto"),
      images: (() => {
        const images: Array<{ src: string; uploadState: string }> = [];
        instance.state.doc.descendants((node) => {
          if (node.type.name === "image" && node.attrs.src) {
            images.push({ src: String(node.attrs.src), uploadState: String(node.attrs.uploadState ?? "ready") });
          }
        });
        return images;
      })(),
      columns: instance.isActive("strategyColumns"),
      columnCount: Number(instance.getAttributes("strategyColumns").count ?? 2),
    }) : null,
  });

  function setIndent(delta: number) {
    if (!editor) return;
    const current = Number(editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").indent ?? 0);
    const next = Math.max(0, Math.min(4, current + delta));
    editor.chain().focus().updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", { indent: next }).run();
  }

  function retrySelectedImage() {
    if (!editor) return;
    const attributes = editor.getAttributes("image");
    const source = String(attributes.src ?? "");
    const file = failedUploadsRef.current.get(source);
    if (file) {
      editor.chain().focus().updateAttributes("image", { uploadState: "uploading" }).run();
      void uploadOne(file, source);
    } else if (isExternalImageSource(source)) {
      failedExternalUploadsRef.current.delete(source);
      void importExternalImage(source);
    }
  }

  function deleteImage(source: string) {
    if (!editor) return;
    let targetPosition = -1;
    let targetSize = 0;
    editor.state.doc.descendants((node, position) => {
      if (targetPosition < 0 && node.type.name === "image" && node.attrs.src === source) {
        targetPosition = position;
        targetSize = node.nodeSize;
      }
    });
    if (targetPosition >= 0) {
      editor.view.dispatch(editor.state.tr.delete(targetPosition, targetPosition + targetSize));
      failedUploadsRef.current.delete(source);
      failedExternalUploadsRef.current.delete(source);
      activeExternalUploadsRef.current.delete(source);
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    }
  }

  if (!editor) return <div className="min-h-72 animate-pulse bg-slate-900/30" />;

  return (
    <div className={`strategy-rich-shell ${editable ? "is-editable" : "is-readonly"}`}>
      {editable && (
        <div className="strategy-toolbar" role="toolbar" aria-label="攻略格式工具栏">
          <ToolbarButton title="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
          <Select
            aria-label="段落样式"
            className="h-9 w-28 text-xs"
            value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
            }}
          >
            <option value="p">正文</option><option value="h1">大标题</option><option value="h2">标题</option><option value="h3">小标题</option>
          </Select>
          <Select aria-label="字号" className="h-9 w-20 text-xs" value={editor.getAttributes("textStyle").fontSize ?? "16px"} onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}>
            {[14, 16, 18, 24, 32].map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
          </Select>
          <ToolbarButton title="粗体" active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="斜体" active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="下划线" active={state?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolbarButton>
          <div className="flex items-center gap-1 px-1" aria-label="文字颜色">
            {["#e2e8f0", "#38bdf8", "#34d399", "#facc15", "#fb923c", "#f87171"].map((color) => (
              <button key={color} type="button" title={`文字色 ${color}`} className="h-5 w-5 rounded-sm border border-white/20" style={{ backgroundColor: color }} onClick={() => editor.chain().focus().setColor(color).run()} />
            ))}
          </div>
          <div className="flex items-center gap-1 px-1" aria-label="文字底色">
            {["#164e63", "#14532d", "#713f12", "#7f1d1d", "#4c1d95"].map((color) => (
              <button key={color} type="button" title={`文字底色 ${color}`} className="h-5 w-5 rounded-sm border border-white/20" style={{ backgroundColor: color }} onClick={() => editor.chain().focus().setHighlight({ color }).run()} />
            ))}
          </div>
          <ToolbarButton title="左对齐" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="居中" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="右对齐" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="无序列表" active={state?.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="有序列表" active={state?.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="减少缩进" onClick={() => setIndent(-1)}><IndentDecrease className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="增加缩进" onClick={() => setIndent(1)}><IndentIncrease className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="添加链接" onClick={() => { const href = window.prompt("链接地址"); if (href) editor.chain().focus().setLink({ href }).run(); }}><LinkIcon className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="插入双栏" onClick={() => editor.chain().focus().insertContent(columnsContent(2)).run()}><Columns2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="插入三栏" onClick={() => editor.chain().focus().insertContent(columnsContent(3)).run()}><Columns3 className="h-4 w-4" /></ToolbarButton>
          {state?.columns && (
            <div className="inline-flex h-9 overflow-hidden rounded-md border border-slate-700" aria-label="图片组列数">
              {[1, 2, 3].map((count) => (
                <button key={count} type="button" title={`${count} 列`} aria-pressed={state.columnCount === count} className={cn("w-9 text-xs font-bold text-slate-400", state.columnCount === count && "bg-sky-950/60 text-sky-200")} onClick={() => editor.chain().focus().updateAttributes("strategyColumns", { count }).run()}>{count}</button>
              ))}
            </div>
          )}
          <ToolbarButton title="插入提示块" onClick={() => editor.chain().focus().insertContent({ type: "strategyCallout", attrs: { tone: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", text: "注意事项" }] }] }).run()}><MessageSquareWarning className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton title="插入图片" onClick={() => fileInputRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolbarButton>
          {state?.image && (
            <div className="inline-flex h-9 overflow-hidden rounded-md border border-slate-700" aria-label="图片宽度">
              {[25, 50, 75, 100].map((width) => (
                <button key={width} type="button" title={`图片宽度 ${width}%`} aria-pressed={state.imageWidth === `${width}%`} className={cn("w-10 text-[10px] font-bold text-slate-400", state.imageWidth === `${width}%` && "bg-sky-950/60 text-sky-200")} onClick={() => editor.chain().focus().updateAttributes("image", { displayWidth: `${width}%` }).run()}>{width}%</button>
              ))}
            </div>
          )}
          {state?.imageError && <ToolbarButton title="重试图片上传" onClick={retrySelectedImage}><RefreshCw className="h-4 w-4" /></ToolbarButton>}
          <ToolbarButton title="清除格式" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-4 w-4" /></ToolbarButton>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => { insertFiles([...(event.target.files ?? [])]); event.currentTarget.value = ""; }} />
        </div>
      )}

      <div className={editable ? "strategy-editor-layout" : ""}>
        <div className="strategy-editor-canvas">
          <EditorContent editor={editor} />
          {uploadError && <p role="alert" className="mt-3 text-sm text-red-300">{uploadError}</p>}
        </div>

        {editable && (
          <aside className="strategy-assets-panel">
            <div className="grid grid-cols-3 border-b border-slate-700/60">
              <button type="button" className={assetPanel === "images" ? "strategy-panel-tab is-active" : "strategy-panel-tab"} onClick={() => setAssetPanel("images")}>图片</button>
              <button type="button" className={assetPanel === "cards" ? "strategy-panel-tab is-active" : "strategy-panel-tab"} onClick={() => setAssetPanel("cards")}>作业卡</button>
              <button type="button" className={assetPanel === "markdown" ? "strategy-panel-tab is-active" : "strategy-panel-tab"} onClick={() => setAssetPanel("markdown")}>Markdown</button>
            </div>
            {assetPanel === "images" ? (
              <div className="space-y-3 p-3">
                <Button type="button" variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}><ImagePlus className="h-4 w-4" /> 添加图片</Button>
                <div className="grid grid-cols-2 gap-2">
                  {state?.images.map((image, index) => (
                    <div key={`${image.src}-${index}`} className="relative aspect-video overflow-hidden rounded-md border border-slate-700 bg-slate-950/70">
                      <div aria-label={`攻略图片 ${index + 1}`} className={cn("h-full w-full bg-contain bg-center bg-no-repeat", image.uploadState !== "ready" && "opacity-45")} style={{ backgroundImage: `url(${JSON.stringify(image.src)})` }} />
                      <button type="button" title="删除图片" aria-label={`删除攻略图片 ${index + 1}`} className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-950/90 text-slate-300 hover:border-red-400 hover:text-red-300" onClick={() => deleteImage(image.src)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
                {state?.images.length === 0 && <p className="py-8 text-center text-xs text-slate-500">暂无图片</p>}
              </div>
            ) : assetPanel === "cards" ? (
              <div className="space-y-3 p-3">
                <Input value={routineQuery} onChange={(event) => setRoutineQuery(event.target.value)} placeholder="搜索海域、任务、上传者" />
                {routineLoading && <p className="text-xs text-slate-500">搜索中…</p>}
                <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
                  {routineCards.map((card) => (
                    <button key={card.id} type="button" className={cn("w-full rounded-md border bg-slate-900/45 p-2 text-left hover:border-sky-500/50 hover:bg-sky-950/20", routineReplacement ? "border-amber-400/60" : "border-slate-700/70")} onClick={() => { if (routineReplacement) { routineReplacement(card.id); setRoutineReplacement(null); } else { editor.chain().focus().insertRoutineCard({ routineCardId: card.id, displayMode: "compact" }).run(); } }}>
                      <span className="block text-sm font-medium text-slate-100">{card.seaArea} / {card.missionName}</span>
                      <span className="mt-1 block text-xs text-slate-500">{card.user.name} · 制空 {card.airControl}</span>
                    </button>
                  ))}
                  {!routineLoading && routineCards.length === 0 && <p className="py-8 text-center text-xs text-slate-500">没有匹配的作业卡</p>}
                </div>
                {routineTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs text-slate-500">
                    <Button type="button" variant="ghost" disabled={routinePage <= 1 || routineLoading} onClick={() => setRoutinePage((page) => Math.max(1, page - 1))}>上一页</Button>
                    <span>{routinePage} / {routineTotalPages}</span>
                    <Button type="button" variant="ghost" disabled={routinePage >= routineTotalPages || routineLoading} onClick={() => setRoutinePage((page) => Math.min(routineTotalPages, page + 1))}>下一页</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-3">
                <textarea value={markdownInput} onChange={(event) => setMarkdownInput(event.target.value)} placeholder="粘贴 Markdown" className="min-h-48 w-full resize-y rounded-md border border-slate-700 bg-slate-950/60 p-2 font-mono text-xs text-slate-200 outline-none focus:border-sky-500/60" />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" onClick={() => editor.chain().focus().insertContent(markdownInput, { contentType: "markdown" }).run()}>插入</Button>
                  <Button type="button" variant="secondary" onClick={() => editor.commands.setContent(markdownInput, { contentType: "markdown" })}>替换</Button>
                </div>
                <Button type="button" variant="ghost" className="w-full" onClick={() => void navigator.clipboard.writeText(editor.getMarkdown())}>复制为 Markdown</Button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

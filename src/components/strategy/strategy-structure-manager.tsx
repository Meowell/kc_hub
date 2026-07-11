"use client";

import { Archive, Copy, GripVertical, Layers3, Pencil, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { StrategyLockTag, StrategyMapView, StrategySectionView } from "@/components/strategy/strategy-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getLockTagColorClassName, getLockTagColorStyle, isCustomLockTagColor } from "@/lib/lock-tag-colors";
import { cn } from "@/lib/utils";

async function apiRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "操作失败");
  return payload;
}

function TagPicker({ tags, selected, onChange }: {
  tags: StrategyLockTag[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const checked = selected.includes(tag.id);
        return (
          <label
            key={tag.id}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-opacity",
              getLockTagColorClassName(tag.colorClass),
              !isCustomLockTagColor(tag.colorClass) && "text-slate-900",
              checked ? "border-white/80 ring-2 ring-sky-400/70" : "border-transparent opacity-55",
              !tag.isActive && "grayscale",
            )}
            style={getLockTagColorStyle(tag.colorClass)}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])}
              className="sr-only"
            />
            {tag.name}{!tag.isActive ? "（停用）" : ""}
          </label>
        );
      })}
    </div>
  );
}

function SectionEditor({ section, map, tags, onDone }: {
  section: StrategySectionView;
  map: StrategyMapView;
  tags: StrategyLockTag[];
  onDone: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [tagIds, setTagIds] = useState(section.lockTags.map((entry) => entry.lockTagId));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setError("");
    try {
      await apiRequest("/api/strategy/sections", "PATCH", {
        id: section.id,
        strategyMapId: map.id,
        name,
        sortOrder: section.sortOrder,
        lockTagIds: tagIds,
        isDeleted: section.isDeleted,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 rounded-md border border-sky-500/35 bg-sky-950/15 p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="分块名称，例如 解密1 / P1" />
      <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
        <Button type="button" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "保存中…" : "保存分块"}</Button>
      </div>
    </div>
  );
}

export function StrategyStructureManager({ activityId, initialMaps, lockTags }: {
  activityId: string;
  initialMaps: StrategyMapView[];
  lockTags: StrategyLockTag[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [maps, setMaps] = useState(initialMaps);
  const [newMapCode, setNewMapCode] = useState("");
  const [newSectionByMap, setNewSectionByMap] = useState<Record<string, string>>({});
  const [newTagsByMap, setNewTagsByMap] = useState<Record<string, string[]>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ type: "map" | "section"; id: string; mapId?: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setMaps(initialMaps), [initialMaps]);
  const activeMaps = useMemo(() => maps.filter((map) => !map.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder), [maps]);
  const archivedMaps = useMemo(() => maps.filter((map) => map.isDeleted), [maps]);

  async function refreshAfter(task: () => Promise<unknown>) {
    setBusy(true); setError("");
    try {
      await task();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally { setBusy(false); }
  }

  async function createMap() {
    const code = newMapCode.trim();
    if (!code) return;
    await refreshAfter(() => apiRequest("/api/strategy/maps", "POST", { activityId, code }));
    setNewMapCode("");
  }

  async function patchMap(map: StrategyMapView, changes: Partial<StrategyMapView>) {
    await refreshAfter(() => apiRequest("/api/strategy/maps", "PATCH", {
      id: map.id,
      activityId,
      code: changes.code ?? map.code,
      sortOrder: changes.sortOrder ?? map.sortOrder,
      isOpenForPosts: changes.isOpenForPosts ?? map.isOpenForPosts,
      isDeleted: changes.isDeleted ?? map.isDeleted,
    }));
  }

  async function createSection(map: StrategyMapView) {
    const name = newSectionByMap[map.id]?.trim();
    if (!name) return;
    await refreshAfter(() => apiRequest("/api/strategy/sections", "POST", {
      strategyMapId: map.id,
      name,
      lockTagIds: newTagsByMap[map.id] ?? [],
    }));
    setNewSectionByMap((value) => ({ ...value, [map.id]: "" }));
  }

  async function archiveSection(section: StrategySectionView) {
    if (section.postCount > 0 && !window.confirm(`归档后 ${section.postCount} 篇攻略会从目录隐藏，确认归档？`)) return;
    await refreshAfter(() => apiRequest(`/api/strategy/sections?id=${encodeURIComponent(section.id)}`, "DELETE"));
  }

  async function restoreSection(map: StrategyMapView, section: StrategySectionView) {
    await refreshAfter(() => apiRequest("/api/strategy/sections", "PATCH", {
      id: section.id,
      strategyMapId: map.id,
      name: section.name,
      sortOrder: section.sortOrder,
      lockTagIds: section.lockTags.map((entry) => entry.lockTagId),
      isDeleted: false,
    }));
  }

  async function reorderMaps(targetId: string) {
    if (!dragging || dragging.type !== "map" || dragging.id === targetId) return;
    const sourceIndex = activeMaps.findIndex((map) => map.id === dragging.id);
    const targetIndex = activeMaps.findIndex((map) => map.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...activeMaps];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    setMaps((current) => [...next.map((map, index) => ({ ...map, sortOrder: index })), ...current.filter((map) => map.isDeleted)]);
    await refreshAfter(() => Promise.all(next.map((map, index) => apiRequest("/api/strategy/maps", "PATCH", { id: map.id, activityId, code: map.code, sortOrder: index, isOpenForPosts: map.isOpenForPosts, isDeleted: false }))));
    setDragging(null);
  }

  async function reorderSections(map: StrategyMapView, targetId: string) {
    if (!dragging || dragging.type !== "section" || dragging.mapId !== map.id || dragging.id === targetId) return;
    const sections = map.sections.filter((section) => !section.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder);
    const sourceIndex = sections.findIndex((section) => section.id === dragging.id);
    const targetIndex = sections.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...sections];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    await refreshAfter(() => Promise.all(next.map((section, index) => apiRequest("/api/strategy/sections", "PATCH", {
      id: section.id,
      strategyMapId: map.id,
      name: section.name,
      sortOrder: index,
      lockTagIds: section.lockTags.map((entry) => entry.lockTagId),
      isDeleted: false,
    }))));
    setDragging(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}><Layers3 className="h-4 w-4" /> 管理攻略分块</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>活动攻略结构</DialogTitle>
            <DialogDescription>先整理海图和分块，再逐个海图开放个人攻略投稿。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={newMapCode} onChange={(event) => setNewMapCode(event.target.value.toUpperCase())} placeholder="新海图，例如 E1" />
            <Button type="button" disabled={busy || !newMapCode.trim()} onClick={() => void createMap()}><Plus className="h-4 w-4" /> 新增海图</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 space-y-4">
            {activeMaps.map((map) => {
              const activeSections = map.sections.filter((section) => !section.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder);
              const archivedSections = map.sections.filter((section) => section.isDeleted);
              const postCount = map.sections.reduce((sum, section) => sum + section.postCount, 0);
              return (
                <section key={map.id} draggable onDragStart={() => setDragging({ type: "map", id: map.id })} onDragOver={(event) => event.preventDefault()} onDrop={() => void reorderMaps(map.id)} className="rounded-md border border-slate-700 bg-slate-950/35">
                  <header className="flex flex-wrap items-center gap-3 border-b border-slate-700/70 px-3 py-2">
                    <GripVertical className="h-4 w-4 cursor-grab text-slate-500" />
                    <span className="text-base font-bold text-white">{map.code}</span>
                    <span className="text-xs text-slate-500">{activeSections.length} 分块 · {postCount} 篇攻略</span>
                    <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={map.isOpenForPosts} disabled={busy} onChange={(event) => {
                        if (!event.target.checked && postCount > 0 && !window.confirm(`关闭后 ${postCount} 篇攻略将变为只读，确认关闭？`)) return;
                        void patchMap(map, { isOpenForPosts: event.target.checked });
                      }} />
                      {map.isOpenForPosts ? "已开放投稿" : "整理中"}
                    </label>
                    <button type="button" className="icon-button" title="重命名海图" onClick={() => { const code = window.prompt("海图代码", map.code)?.trim(); if (code && code !== map.code) void patchMap(map, { code }); }}><Pencil className="h-4 w-4" /></button>
                    <button type="button" className="icon-button" title="归档海图" onClick={() => { if (postCount > 0 && !window.confirm(`归档后 ${postCount} 篇攻略会从目录隐藏，确认归档？`)) return; void refreshAfter(() => apiRequest(`/api/strategy/maps?id=${map.id}`, "DELETE")); }}><Archive className="h-4 w-4" /></button>
                  </header>
                  <div className="space-y-2 p-3">
                    {activeSections.map((section) => editingSectionId === section.id ? (
                      <SectionEditor key={section.id} section={section} map={map} tags={lockTags} onDone={() => { setEditingSectionId(null); router.refresh(); }} />
                    ) : (
                      <div key={section.id} draggable onDragStart={(event) => { event.stopPropagation(); setDragging({ type: "section", id: section.id, mapId: map.id }); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); void reorderSections(map, section.id); }} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-900/45 px-2.5 py-2">
                        <GripVertical className="h-4 w-4 cursor-grab text-slate-600" />
                        <span className="text-sm font-semibold text-slate-100">{map.code} {section.name}</span>
                        <div className="flex flex-wrap gap-1">
                          {section.lockTags.map(({ lockTag }) => <span key={lockTag.id} className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", getLockTagColorClassName(lockTag.colorClass), !isCustomLockTagColor(lockTag.colorClass) && "text-slate-900")} style={getLockTagColorStyle(lockTag.colorClass)}>{lockTag.name}</span>)}
                        </div>
                        <span className="ml-auto text-[11px] text-slate-600">{section.postCount} 篇</span>
                        <button type="button" className="icon-button" title="编辑分块" onClick={() => setEditingSectionId(section.id)}><Pencil className="h-4 w-4" /></button>
                        <button type="button" className="icon-button" title="归档分块" onClick={() => void archiveSection(section)}><Archive className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <div className="space-y-2 rounded-md border border-dashed border-slate-700 p-3">
                      <div className="flex gap-2">
                        <Input value={newSectionByMap[map.id] ?? ""} onChange={(event) => setNewSectionByMap((value) => ({ ...value, [map.id]: event.target.value }))} placeholder="新分块，例如 解密1 / P1" />
                        <Button type="button" variant="secondary" title="复制上一分块贴条" disabled={activeSections.length === 0} onClick={() => setNewTagsByMap((value) => ({ ...value, [map.id]: activeSections.at(-1)?.lockTags.map((entry) => entry.lockTagId) ?? [] }))}><Copy className="h-4 w-4" /></Button>
                        <Button type="button" disabled={busy || !newSectionByMap[map.id]?.trim()} onClick={() => void createSection(map)}><Plus className="h-4 w-4" /> 添加</Button>
                      </div>
                      <TagPicker tags={lockTags.filter((tag) => tag.isActive)} selected={newTagsByMap[map.id] ?? []} onChange={(ids) => setNewTagsByMap((value) => ({ ...value, [map.id]: ids }))} />
                    </div>
                    {archivedSections.length > 0 && <div className="flex flex-wrap gap-2 pt-2">{archivedSections.map((section) => <button key={section.id} type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:text-slate-200" onClick={() => void restoreSection(map, section)}><RotateCcw className="h-3.5 w-3.5" /> 恢复 {section.name}</button>)}</div>}
                  </div>
                </section>
              );
            })}
            {activeMaps.length === 0 && <p className="py-10 text-center text-sm text-slate-500">先添加第一张活动海图</p>}
            {archivedMaps.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">{archivedMaps.map((map) => <button key={map.id} type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-500 hover:text-slate-200" onClick={() => void patchMap(map, { isDeleted: false })}><RotateCcw className="h-3.5 w-3.5" /> 恢复 {map.code}</button>)}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

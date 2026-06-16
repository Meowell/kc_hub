"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { tagColorClasses } from "@/lib/validators";

type TagInfo = { id: string; name: string; colorClass: string; sortOrder: number };

type TagManagerProps = {
  tags: TagInfo[];
  deleteImpacts?: Record<string, { planCount: number; assignedShipCount: number; affectedUserIds: string[] }>;
  onAdd: (name: string, colorClass: string) => Promise<void>;
  onEdit: (id: string, name: string, colorClass: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TagManager({ tags, deleteImpacts = {}, onAdd, onEdit, onDelete }: TagManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingTag, setEditingTag] = useState<TagInfo | null>(null);
  const [tagToDisable, setTagToDisable] = useState<TagInfo | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("bg-red-200");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    try { await onAdd(newName.trim(), newColor); setNewName(""); setNewColor("bg-red-200"); setIsAdding(false); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (!editingTag || !newName.trim()) return;
    setSaving(true);
    try { await onEdit(editingTag.id, newName.trim(), newColor); setEditingTag(null); }
    finally { setSaving(false); }
  }

  async function handleDisable() {
    if (!tagToDisable) return;
    setSaving(true);
    try {
      await onDelete(tagToDisable.id);
      setTagToDisable(null);
    } finally {
      setSaving(false);
    }
  }

  const disableImpact = tagToDisable ? deleteImpacts[tagToDisable.id] : null;

  return (
    <>
      <Card className="flex flex-wrap items-center gap-2 bg-slate-800/40 border-slate-700/50">
        <span className="terminal-label mr-1 text-xs font-semibold text-slate-400">LOCK TAGS / 锁船标签</span>
        {tags.map((tag) => (
          <div key={tag.id} className="group relative">
            <span
              className={cn("inline-flex cursor-pointer items-center rounded-md px-4 py-1.5 text-sm font-bold text-slate-800 hover:ring-2 hover:ring-white/30 transition-all", tag.colorClass)}
              onClick={() => { setEditingTag(tag); setNewName(tag.name); setNewColor(tag.colorClass); }}
              title="点击编辑"
            >
              {tag.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTagToDisable(tag);
              }}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-sm bg-red-500 text-[10px] text-white group-hover:flex"
              title="停用标签"
            >
              ✕
            </button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setIsAdding(true)} className="text-xs py-1">
          + 新增标签
        </Button>
      </Card>

      <Dialog open={isAdding || !!editingTag} onOpenChange={(open) => { if (!open) { setIsAdding(false); setEditingTag(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? `编辑标签 "${editingTag.name}"` : "新增标签"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">标签名</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如 E1, 绿条..."
                onKeyDown={(e) => { if (e.key === "Enter") editingTag ? handleEdit() : handleAdd(); }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">颜色</label>
              <div className="grid grid-cols-4 gap-2">
                {tagColorClasses.map((color) => (
                  <button
                    key={color} type="button"
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "h-10 rounded-lg border-2 transition-all", color,
                      newColor === color ? "border-white ring-2 ring-white/20 scale-105" : "border-transparent hover:ring-2 hover:ring-white/10",
                    )}
                    title={color.replace("bg-", "").replace("-200", "")}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setIsAdding(false); setEditingTag(null); }}>取消</Button>
            <Button onClick={editingTag ? handleEdit : handleAdd} disabled={saving || !newName.trim()}>
              {saving ? "保存中..." : editingTag ? "保存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!tagToDisable}
        onOpenChange={(open) => {
          if (!open) setTagToDisable(null);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>停用锁船标签</AlertDialogTitle>
          <AlertDialogDescription>
            {tagToDisable ? `将停用「${tagToDisable.name}」。标签会从当前矩阵隐藏，已有锁船计划保留在数据库中，后续可通过恢复能力重新启用。` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-border-base bg-slate-950/30 px-2 py-3">
            <p className="terminal-label text-[10px] text-slate-500">PLANS</p>
            <p className="mt-1 text-lg font-semibold text-white">{disableImpact?.planCount ?? 0}</p>
          </div>
          <div className="border border-border-base bg-slate-950/30 px-2 py-3">
            <p className="terminal-label text-[10px] text-slate-500">SHIPS</p>
            <p className="mt-1 text-lg font-semibold text-white">{disableImpact?.assignedShipCount ?? 0}</p>
          </div>
          <div className="border border-border-base bg-slate-950/30 px-2 py-3">
            <p className="terminal-label text-[10px] text-slate-500">USERS</p>
            <p className="mt-1 text-lg font-semibold text-white">{disableImpact?.affectedUserIds.length ?? 0}</p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setTagToDisable(null)}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction variant="danger" onClick={handleDisable} disabled={saving}>
            {saving ? "停用中..." : "确认停用"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}

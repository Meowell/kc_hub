"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FleetEditor } from "@/components/routine/fleet-editor";
import { createFleetParser, type FleetParser } from "@/lib/fleet-parser";
import { useMasterData } from "@/lib/use-master-data";
import { useDirtyForm } from "@/components/common/dirty-guard";
import { shouldFlushLatestSnapshot } from "@/lib/frontend-ux";

/* ── Fleet preview helper ── */

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <Button type="button" variant="secondary" onClick={() => setShow(true)} className="px-3" aria-label="删除作业卡">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-red-400">确认删除？</span>
      <button type="button" onClick={onConfirm} className="text-[11px] text-red-400 hover:text-red-300 font-medium px-1">确认</button>
      <button type="button" onClick={() => setShow(false)} className="text-[11px] text-slate-500 hover:text-slate-300 px-1">取消</button>
    </div>
  );
}

function FleetPreview({ fleetData, fleetParser }: { fleetData: string; fleetParser: FleetParser }) {
  const fleet = fleetParser.parseFleetData(fleetData);
  if (!fleet) return null;

  return (
    <div className="mt-3 space-y-2">
      {fleet.groups.map((group) => (
        <div key={group.key} className="flex flex-wrap items-center gap-2">
          {(fleet.kind === "combined" || fleet.kind === "strike") && (
            <span className="min-w-16 text-[11px] font-medium text-sky-400">
              {fleet.kind === "strike" ? "游击舰队" : group.key === "f1" ? "第一舰队" : "第二舰队"}
            </span>
          )}
          {group.ships.map((ship, index) => (
            <span key={`${group.key}-${index}`} className="inline-flex items-center gap-1 rounded-md border border-slate-600/30 bg-slate-700/50 px-2 py-1 text-[11px] text-slate-300">
              <span className="text-slate-500">Lv.{ship.level}</span>
              <span>{ship.name}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

type Record = {
  id: string;
  seaArea: string;
  missionName: string;
  airControl: number;
  note: string | null;
  imageUrl: string | null;
  fleetData: string | null;
  createdAt: Date | string;
  user: { id: string; name: string; avatarUrl: string | null };
};

interface RoutineRecordsProps {
  records: Record[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  search: string;
  seaArea: string;
  uploaderId: string;
  activityId: string | null;
  shipData: string | null;
  currentUserId: string;
}

function routinePath(params: {
  page?: number;
  search?: string;
  seaArea?: string;
  uploaderId?: string;
  activityId?: string | null;
}) {
  const query = new URLSearchParams();
  if (params.activityId) query.set("activityId", params.activityId);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.search) query.set("search", params.search);
  if (params.seaArea) query.set("seaArea", params.seaArea);
  if (params.uploaderId) query.set("uploaderId", params.uploaderId);
  const qs = query.toString();
  return qs ? `/routine?${qs}` : "/routine";
}

function renderPageNumbers(
  currentPage: number,
  totalPages: number,
  goToPage: (page: number) => void,
) {
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages.map((p, i) =>
    p === "ellipsis" ? (
      <span key={`e-${i}`} className="px-2 py-1.5 text-xs text-slate-600">
        …
      </span>
    ) : (
      <button
        key={p}
        type="button"
        onClick={() => goToPage(p)}
        className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          p === currentPage
            ? "border-blue-500/50 bg-blue-500/15 text-blue-400"
            : "border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-white hover:border-slate-600"
        }`}
      >
        {p}
      </button>
    ),
  );
}

export function RoutineRecords({
  records,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  search,
  seaArea,
  uploaderId,
  activityId,
  shipData,
  currentUserId,
}: RoutineRecordsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ seaArea: "", missionName: "", note: "", imageUrl: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [fleetDataJson, setFleetDataJson] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<Record | null>(null);
  const [editingRecord, setEditingRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [hideEditor, setHideEditor] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const pendingFleetRef = useRef<string | null>(null);
  const savedFleetRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const isViewer = viewingRecord && !editingRecord;
  const showFleetEditor = editing || (viewingRecord && !hideEditor);

  useEffect(() => () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
  }, []);

  async function flushFleetAutoSave(record = viewingRecord) {
    if (!record || !shouldFlushLatestSnapshot(pendingFleetRef.current, savedFleetRef.current, autoSaveInFlightRef.current)) return;
    const snapshot = pendingFleetRef.current;
    if (!snapshot) return;
    autoSaveInFlightRef.current = true;
    setAutoSaveStatus("pending");
    try {
      const response = await fetch("/api/routine", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          activityId,
          seaArea: record.seaArea,
          missionName: record.missionName,
          airControl: record.airControl,
          note: record.note,
          imageUrl: record.imageUrl,
          fleetData: snapshot,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "自动保存失败");
      savedFleetRef.current = snapshot;
      setAutoSaveStatus("success");
    } catch (saveError) {
      setErr(saveError instanceof Error ? saveError.message : "自动保存失败，请重试。");
      setAutoSaveStatus("error");
    } finally {
      autoSaveInFlightRef.current = false;
      if (pendingFleetRef.current !== snapshot) {
        autoSaveTimerRef.current = setTimeout(() => { void flushFleetAutoSave(record); }, 0);
      }
    }
  }

  function scheduleFleetAutoSave(json: string, record: Record) {
    pendingFleetRef.current = json;
    setAutoSaveStatus("pending");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { void flushFleetAutoSave(record); }, 650);
  }

  async function saveRecord() {
    setMsg("");
    setErr("");
    if (submitting) return false;
    if (!f.seaArea.trim() || !f.missionName.trim()) {
      setErr("请填写海域和任务名。");
      return false;
    }
    setSubmitting(true);
    const isUpdate = !!editingRecordId;
    const body = editingRecordId
      ? { id: editingRecordId, ...f, activityId, fleetData: fleetDataJson }
      : { ...f, activityId, fleetData: fleetDataJson };
    try {
      const res = await fetch("/api/routine", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "保存失败");
      setF({ seaArea: "", missionName: "", note: "", imageUrl: "" });
      setEditing(false);
      setComposerOpen(false);
      setFleetDataJson(null);
      setViewingRecord(null);
      setEditingRecord(false);
      setEditingRecordId(null);
      setHideEditor(false);
      setMsg(isUpdate ? "阵容已更新" : "阵容已分享");
      router.refresh();
      return true;
    } catch (submitError) {
      setErr(submitError instanceof Error ? submitError.message : "保存失败，请重试。");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void saveRecord();
  }

  useDirtyForm(composerOpen || !!editingRecordId, saveRecord);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    router.push(routinePath({ page, search, seaArea, uploaderId, activityId }));
  }

  return (
    <div>
      {!composerOpen && !viewingRecord && (
        <Button type="button" className="mb-4 w-full lg:hidden" onClick={() => { setComposerOpen(true); setEditing(true); }}>
          新建作业卡
        </Button>
      )}
      <div className="flex flex-col gap-6 lg:flex-row">
      {/* Upload Form */}
      <div className={`${composerOpen || viewingRecord ? "block" : "hidden"} w-full shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/70 p-5 shadow-lg shadow-black/10 lg:block lg:w-96 lg:p-6`}>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-white">阵容编辑</h2>
          </div>
          <Input
            value={f.seaArea}
            onChange={(e) => setF({ ...f, seaArea: e.target.value })}
            placeholder="海域 (E1-2)"
            required
          />
          <Input
            value={f.missionName}
            onChange={(e) => setF({ ...f, missionName: e.target.value })}
            placeholder="任务名 (P1削甲)"
            required
          />
          <Textarea
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
            placeholder="备注 / 阵容说明（可选）"
            rows={3}
          />
          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}
          {msg && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {msg}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={editing ? "primary" : "secondary"}
              onClick={() => {
                if (viewingRecord) {
                  setHideEditor(!hideEditor);
                } else {
                  setEditing(!editing);
                }
              }}
              className="flex-1"
            >
              {viewingRecord || editingRecordId ? "编辑阵容" : "新建阵容"}
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? "保存中…" : editingRecordId ? "更新" : "分享"}</Button>
          </div>
        </form>
      </div>

      {/* Right side: Editor or Records List */}
      <div className="flex-1 min-w-0">
        <div className={showFleetEditor ? "" : "hidden"}>
          <FleetEditor
            shipData={shipData}
            initialFleetData={viewingRecord?.fleetData ?? undefined}
            onFleetChange={(json) => {
              setFleetDataJson(json);
              if (editingRecord && viewingRecord) {
                scheduleFleetAutoSave(json, viewingRecord);
              }
            }}
            readOnly={isViewer ?? undefined}
            title={viewingRecord ? `${viewingRecord.seaArea} / ${viewingRecord.missionName}` : undefined}
            onBack={() => { setViewingRecord(null); setEditingRecord(false); setHideEditor(false); }}
          />
          {editingRecord && (
            <div className="mt-3 flex items-center justify-between gap-3" aria-live="polite">
              <p className={autoSaveStatus === "error" ? "text-sm text-red-300" : "text-sm text-slate-400"}>
                {autoSaveStatus === "pending" ? "保存中…" : autoSaveStatus === "success" ? "已保存最新阵容" : autoSaveStatus === "error" ? "保存失败" : ""}
              </p>
              {autoSaveStatus === "error" && <Button type="button" variant="outline" onClick={() => void flushFleetAutoSave()}>重试</Button>}
            </div>
          )}
        </div>
        {!showFleetEditor && (
          <RecordsList
            records={records}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            search={search}
            seaArea={seaArea}
            uploaderId={uploaderId}
            goToPage={goToPage}
            currentUserId={currentUserId}
            onViewRecord={(r) => { setViewingRecord(r); setEditingRecord(false); setEditingRecordId(null); setHideEditor(false); }}
            onEditRecord={(r) => {
              setComposerOpen(true);
              setViewingRecord(r);
              setEditingRecord(true);
              setEditingRecordId(r.id);
              setHideEditor(false);
              setF({ seaArea: r.seaArea, missionName: r.missionName, note: r.note ?? "", imageUrl: r.imageUrl ?? "" });
              setFleetDataJson(r.fleetData);
              pendingFleetRef.current = r.fleetData;
              savedFleetRef.current = r.fleetData;
              setAutoSaveStatus("idle");
            }}
            onDeleteRecord={async (r) => {
              await fetch(`/api/routine?id=${r.id}`, { method: "DELETE" });
              router.refresh();
            }}
          />
        )}
        {viewingRecord && !showFleetEditor && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => { setViewingRecord(null); setEditingRecord(false); setHideEditor(false); }}
              className="text-xs text-slate-400 hover:text-white border border-slate-600/50 rounded-lg px-3 py-1.5 hover:bg-slate-700/50 transition-colors"
            >
              ← 返回列表
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/* ── Internal: Records list + pagination ── */

function RecordsList({
  records,
  currentPage,
  totalPages,
  totalCount,
  search,
  seaArea,
  uploaderId,
  goToPage,
  currentUserId,
  onViewRecord,
  onEditRecord,
  onDeleteRecord,
}: {
  records: Record[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  search: string;
  seaArea: string;
  uploaderId: string;
  goToPage: (page: number) => void;
  currentUserId: string;
  onViewRecord: (r: Record) => void;
  onEditRecord: (r: Record) => void;
  onDeleteRecord: (r: Record) => void;
}) {
  const { masterData } = useMasterData();
  const fleetParser = useMemo(
    () => createFleetParser(masterData),
    [masterData],
  );

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/40 py-16 text-center">
          <p className="text-slate-500">
            {search || seaArea || uploaderId
              ? "没有匹配的记录，试试调整筛选条件"
              : "暂无记录，等待上传者分享阵容"}
          </p>
        </div>
      ) : (
        <>
          {records.map((r, i) => (
            <div
              key={r.id}
              data-testid="routine-record-card"
              className="rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-5 shadow-lg shadow-black/10 group hover:border-slate-600/50 transition-colors"
            >
              <div className="flex gap-4">
                <div className="hidden sm:flex flex-col items-center pt-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                  {i < records.length - 1 && (
                    <div className="w-px flex-1 bg-slate-700/50 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">
                          {r.seaArea} / {r.missionName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500">
                          {new Date(r.createdAt).toLocaleString("zh-CN")}
                        </p>
                        <span className="text-slate-600">·</span>
                        {r.user.avatarUrl && (
                          <Image src={r.user.avatarUrl} alt={r.user.name} width={24} height={24} unoptimized className="h-6 w-6 rounded-full object-cover" />
                        )}
                        <span className="text-sm text-emerald-500/80">
                          {r.user.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {r.fleetData && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onViewRecord(r)}
                          className="px-3 text-xs"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />查看
                        </Button>
                      )}
                      {r.fleetData && r.user.id === currentUserId && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onEditRecord(r)}
                          className="px-3 text-xs"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />编辑
                        </Button>
                      )}
                      {r.user.id === currentUserId && (
                        <DeleteButton onConfirm={() => onDeleteRecord(r)} />
                      )}
                    </div>
                  </div>
                  {r.note && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                      {r.note}
                    </p>
                  )}
                  {/* Fleet preview */}
                  {r.fleetData && <FleetPreview fleetData={r.fleetData} fleetParser={fleetParser} />}
                  {r.imageUrl && (
                    <div className="mt-4 rounded-lg border border-slate-700/50 overflow-hidden">
                      <Image
                        src={r.imageUrl}
                        alt={r.missionName}
                        width={1200}
                        height={800}
                        unoptimized
                        className="h-auto max-h-80 w-full object-contain bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              共 <span className="text-slate-300 font-medium">{totalCount}</span>{" "}
              条记录，第{" "}
              <span className="text-slate-300 font-medium">{currentPage}</span>/
              {totalPages} 页
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={currentPage <= 1}
                className="hidden min-h-11 rounded-lg border border-slate-700/50 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:block"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="min-h-11 rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                ‹ 上一页
              </button>

              <div className="hidden items-center gap-1.5 sm:flex">{renderPageNumbers(currentPage, totalPages, goToPage)}</div>

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="min-h-11 rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                下一页 ›
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="hidden min-h-11 rounded-lg border border-slate-700/50 bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:block"
              >
                »
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

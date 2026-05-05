"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FleetEditor } from "@/components/routine/fleet-editor";
import start2 from "@/data/START2.json";

/* ── Fleet preview helper ── */

const previewShipNames = new Map(
  (start2.api_mst_ship as { api_id: number; api_name: string }[]).map((s) => [s.api_id, s.api_name]),
);

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <Button type="button" variant="secondary" onClick={() => setShow(true)} className="text-xs h-7 px-2.5">
        🗑️
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

function FleetPreview({ fleetData }: { fleetData: string }) {
  let ships: { name: string; level: number }[] = [];
  try {
    const json = JSON.parse(fleetData);
    const f1 = json.f1;
    if (f1) {
      for (let i = 1; i <= 6; i++) {
        const s = f1[`s${i}`];
        if (s && s.id) {
          ships.push({
            name: previewShipNames.get(s.id) ?? `ID:${s.id}`,
            level: s.lv ?? 0,
          });
        }
      }
    }
  } catch { /* ignore */ }

  if (ships.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      {ships.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] bg-slate-700/50 border border-slate-600/30 text-slate-300">
          <span className="text-slate-500">Lv.{s.level}</span>
          <span>{s.name}</span>
        </span>
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
  user: { id: string; name: string };
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
  shipData: string | null;
  currentUserId: string;
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
  const isViewer = viewingRecord && !editingRecord;
  const showFleetEditor = editing || (viewingRecord && !hideEditor);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const isUpdate = !!editingRecordId;
    const body = editingRecordId
      ? { id: editingRecordId, ...f, fleetData: fleetDataJson }
      : { ...f, fleetData: fleetDataJson };
    const res = await fetch("/api/routine", {
      method: isUpdate ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) {
      setErr(d.error ?? "保存失败");
      return;
    }
    setF({ seaArea: "", missionName: "", note: "", imageUrl: "" });
    setEditing(false);
    setFleetDataJson(null);
    setViewingRecord(null);
    setEditingRecord(false);
    setEditingRecordId(null);
    setHideEditor(false);
    setMsg(isUpdate ? "阵容已更新 ✅" : "阵容已分享 ✅");
    router.refresh();
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search) params.set("search", search);
    if (seaArea) params.set("seaArea", seaArea);
    if (uploaderId) params.set("uploaderId", uploaderId);
    const qs = params.toString();
    router.push(qs ? `/routine?${qs}` : "/routine");
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Upload Form */}
      <div className="w-full lg:w-96 shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/70 backdrop-blur-sm p-6 shadow-lg shadow-black/10">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📤</span>
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
              {viewingRecord || editingRecordId ? "⚙️ 编辑阵容" : "➕ 新建阵容"}
            </Button>
            <Button type="submit" className="flex-1">{editingRecordId ? "📤 更新" : "📤 分享"}</Button>
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
              // Auto-save when editing existing record
              if (editingRecord && viewingRecord) {
                fetch("/api/routine", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ id: viewingRecord.id, fleetData: json }),
                }).catch(() => {});
              }
            }}
            readOnly={isViewer ?? undefined}
            title={viewingRecord ? `${viewingRecord.seaArea} / ${viewingRecord.missionName}` : undefined}
            onBack={() => { setViewingRecord(null); setEditingRecord(false); setHideEditor(false); }}
          />
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
              setViewingRecord(r);
              setEditingRecord(true);
              setEditingRecordId(r.id);
              setHideEditor(false);
              setF({ seaArea: r.seaArea, missionName: r.missionName, note: r.note ?? "", imageUrl: r.imageUrl ?? "" });
              setFleetDataJson(r.fleetData);
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
  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/40 py-16 text-center">
          <p className="text-4xl mb-3">📭</p>
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
                  <div className="flex items-start justify-between gap-3">
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
                        <span className="text-xs text-emerald-500/80">
                          {r.user.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.fleetData && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onViewRecord(r)}
                          className="text-xs h-7 px-2.5"
                        >
                          👁️ 查看
                        </Button>
                      )}
                      {r.fleetData && r.user.id === currentUserId && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onEditRecord(r)}
                          className="text-xs h-7 px-2.5"
                        >
                          ✏️ 编辑
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
                  {r.fleetData && <FleetPreview fleetData={r.fleetData} />}
                  {r.imageUrl && (
                    <div className="mt-4 rounded-lg border border-slate-700/50 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imageUrl}
                        alt={r.missionName}
                        className="w-full max-h-80 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              共 <span className="text-slate-300 font-medium">{totalCount}</span>{" "}
              条记录，第{" "}
              <span className="text-slate-300 font-medium">{currentPage}</span>/
              {totalPages} 页
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={currentPage <= 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ‹ 上一页
              </button>

              {renderPageNumbers(currentPage, totalPages, goToPage)}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                下一页 ›
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700/50 bg-slate-800/70 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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

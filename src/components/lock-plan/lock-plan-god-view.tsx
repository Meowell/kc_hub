"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConflictAlertDialog } from "@/components/lock-plan/conflict-alert-dialog";
import { ShipPickerModal, type ShipLockInfo } from "@/components/lock-plan/ship-picker-modal";
import { TagManager } from "@/components/lock-plan/tag-manager";
import { UserLockRow } from "@/components/lock-plan/user-lock-row";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { parseAssignments, type LockAssignment } from "@/lib/lock-plan-helpers";
import { createMasterLookup, getShipNameFromLookup, getShipTypeFromLookup } from "@/lib/master-data";
import { deriveShipStock, type ShipStock } from "@/lib/noro6";
import { useMasterData } from "@/lib/use-master-data";

// ============================================================
// Types matching API response shape
// ============================================================

type TagDTO = { id: string; name: string; colorClass: string; sortOrder: number; isActive: boolean };
type PlanDTO = { planId: string; tagId: string; assignedData: string; note: string | null; updatedAt: string };
type UserDTO = { userId: string; userName: string; avatarUrl: string | null; hasShipData: boolean; plans: PlanDTO[] };

type GlobalData = { tags: TagDTO[]; users: UserDTO[] };
type SavedPlanDTO = {
  id: string;
  userId: string;
  tagId: string;
  assignedData: string;
  note: string | null;
  updatedAt: string;
};
type PlanMutation = {
  userId: string;
  tagId: string;
  assignedData: string;
  note?: string | null;
};

class PlanSaveConflictError extends Error {}

// ============================================================
// Props
// ============================================================

type LockPlanGodViewProps = {
  initialTags: TagDTO[];
  initialUsers: Array<{
    userId: string;
    userName: string;
    avatarUrl: string | null;
    hasShipData: boolean;
    shipDataRaw: string;
    plans: PlanDTO[];
  }>;
  activityId: string | null;
  activityLabel: string;
  isDailyScope: boolean;
};

export function LockPlanGodView({ initialTags, initialUsers, activityId, activityLabel, isDailyScope }: LockPlanGodViewProps) {
  const { masterData } = useMasterData();
  const masterLookup = useMemo(() => createMasterLookup(masterData), [masterData]);
  const getShipName = useCallback(
    (shipId: number) => getShipNameFromLookup(masterLookup, shipId),
    [masterLookup],
  );
  const getShipType = useCallback(
    (shipId: number) => getShipTypeFromLookup(masterLookup, shipId),
    [masterLookup],
  );
  const getShipTypeId = useCallback(
    (shipId: number) => String(masterLookup.shipTypeById.get(shipId) ?? ""),
    [masterLookup],
  );

  // ---- Tag state (optimistic) ----
  const [tags, setTags] = useState<TagDTO[]>(initialTags);

  // ---- Plans state: userId -> tagId -> assignedData ----
  const [plansByUser, setPlansByUser] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const u of initialUsers) {
      map[u.userId] = {};
      for (const p of u.plans) {
        map[u.userId][p.tagId] = p.assignedData;
      }
    }
    return map;
  });

  const [planIdsByUser, setPlanIdsByUser] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const u of initialUsers) {
      map[u.userId] = {};
      for (const p of u.plans) {
        map[u.userId][p.tagId] = p.planId;
      }
    }
    return map;
  });

  const [planVersionsByUser, setPlanVersionsByUser] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const u of initialUsers) {
      map[u.userId] = {};
      for (const p of u.plans) {
        map[u.userId][p.tagId] = p.updatedAt;
      }
    }
    return map;
  });

  // ---- Ship stocks per user (parsed from shipData and current runtime master data) ----
  const shipsByUser = useMemo<Record<string, ShipStock[]>>(() => {
    const map: Record<string, ShipStock[]> = {};
    for (const u of initialUsers) {
      if (u.shipDataRaw && u.shipDataRaw.trim()) {
        try {
          map[u.userId] = deriveShipStock(u.shipDataRaw, masterLookup.masterByShipId);
        } catch {
          map[u.userId] = [];
        }
      } else {
        map[u.userId] = [];
      }
    }
    return map;
  }, [initialUsers, masterLookup]);

  // ---- Picker state ----
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerUserId, setPickerUserId] = useState<string>("");
  const [pickerTagId, setPickerTagId] = useState<string>("");
  const [pickerCellIndex, setPickerCellIndex] = useState<number>(0);
  const pickerTagIdRef = useRef("");
  const pickerUserIdRef = useRef("");
  const pickerCellIndexRef = useRef(0);

  // ---- Conflict dialog state ----
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    ship: ShipStock;
    currentTagName: string;
    targetTagName: string;
  } | null>(null);
  const pendingAssignmentRef = useRef<ShipStock | null>(null);

  // ---- Error / saving ----
  const [error, setError] = useState("");
  const [planConflictMessage, setPlanConflictMessage] = useState("");

  // ==========================================================
  // Derived: build shipLockMap for each user
  // ==========================================================
  function getShipLockMap(userId: string): Map<string, ShipLockInfo> {
    const map = new Map<string, ShipLockInfo>();
    const userPlans = plansByUser[userId] ?? {};
    for (const tag of tags) {
      const data = userPlans[tag.id];
      if (!data) continue;
      const assignments = parseAssignments(data);
      for (const a of assignments) {
        if (!a) continue;
        map.set(a.uniqueId, {
          uniqueId: a.uniqueId,
          tagColorClass: tag.colorClass,
          tagName: tag.name,
        });
      }
    }
    return map;
  }

  const applySavedPlanVersions = useCallback((savedPlans: SavedPlanDTO[]) => {
    if (savedPlans.length === 0) return;
    setPlanIdsByUser((prev) => {
      const next = structuredClone(prev);
      for (const plan of savedPlans) {
        if (!next[plan.userId]) next[plan.userId] = {};
        next[plan.userId][plan.tagId] = plan.id;
      }
      return next;
    });
    setPlanVersionsByUser((prev) => {
      const next = structuredClone(prev);
      for (const plan of savedPlans) {
        if (!next[plan.userId]) next[plan.userId] = {};
        next[plan.userId][plan.tagId] = plan.updatedAt;
      }
      return next;
    });
  }, []);

  // ==========================================================
  // Save one or two plans with optimistic-concurrency versions
  // ==========================================================
  const savePlans = useCallback(
    async (mutations: PlanMutation[]) => {
      const payloadPlans = mutations.map((mutation) => {
        const id = planIdsByUser[mutation.userId]?.[mutation.tagId];
        return {
          id,
          userId: mutation.userId,
          tagId: mutation.tagId,
          assignedData: mutation.assignedData,
          note: mutation.note ?? null,
          updatedAt: planVersionsByUser[mutation.userId]?.[mutation.tagId],
        };
      });
      const single = payloadPlans.length === 1 ? payloadPlans[0] : null;

      const response = await fetch("/api/lock-plan", {
        method: single ? (single.id ? "PATCH" : "POST") : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(single ?? { plans: payloadPlans }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          throw new PlanSaveConflictError(data.error ?? "该锁船规划刚被其他人修改，请刷新页面后再编辑");
        }
        throw new Error(data.error ?? "保存失败");
      }

      const savedPlans: SavedPlanDTO[] = data.plans ?? (data.plan ? [data.plan] : []);
      applySavedPlanVersions(savedPlans);
      return data;
    },
    [applySavedPlanVersions, planIdsByUser, planVersionsByUser],
  );

  // ==========================================================
  // Core assignment logic (no conflict check)
  // ==========================================================
  async function executeAssign(
    userId: string,
    tagId: string,
    ship: ShipStock,
    targetIndex?: number,
  ) {
    const currentPlans = plansByUser[userId] ?? {};
    const targetData = currentPlans[tagId] ?? "[]";
    // Keep existing structure with nulls, set dup to null if present
    const parsed = parseAssignments(targetData).map((a) =>
      (a && a.uniqueId === ship.uniqueId) ? null : a,
    );

    let newTarget: (LockAssignment | null)[];
    if (targetIndex !== undefined) {
      // Insert at specific index (clicked a specific cell)
      while (parsed.length <= targetIndex) parsed.push(null);
      parsed[targetIndex] = { uniqueId: ship.uniqueId, shipId: ship.shipId };
      // Trim trailing nulls
      while (parsed.length > 0 && parsed[parsed.length - 1] === null) {
        parsed.pop();
      }
      newTarget = parsed;
    } else {
      // No specific index → compact and append at end
      const compacted = parsed.filter((a): a is LockAssignment => a !== null);
      newTarget = [...compacted, { uniqueId: ship.uniqueId, shipId: ship.shipId }];
    }

    // Find which tag this ship is currently locked to
    let sourceTagId: string | null = null;
    for (const tag of tags) {
      const tagData = currentPlans[tag.id] ?? "[]";
      if (parseAssignments(tagData).some((a) => a && a.uniqueId === ship.uniqueId)) {
        sourceTagId = tag.id;
        break;
      }
    }

    if (sourceTagId === tagId) return; // Already in same tag

    let newSource: LockAssignment[] | null = null;
    if (sourceTagId) {
      const sourceData = currentPlans[sourceTagId] ?? "[]";
      newSource = parseAssignments(sourceData)
        .filter((a): a is LockAssignment => a !== null && a.uniqueId !== ship.uniqueId);
      // Trim trailing nulls
      while (newSource.length > 0 && newSource[newSource.length - 1] === null) {
        newSource.pop();
      }
    }

    // Optimistic update
    setPlansByUser((prev) => {
      const next = structuredClone(prev);
      if (!next[userId]) next[userId] = {};
      next[userId][tagId] = JSON.stringify(newTarget);
      if (sourceTagId && newSource) {
        next[userId][sourceTagId] = JSON.stringify(newSource);
      }
      return next;
    });

    try {
      if (sourceTagId && newSource) {
        await savePlans([
          { userId, tagId: sourceTagId, assignedData: JSON.stringify(newSource) },
          { userId, tagId, assignedData: JSON.stringify(newTarget) },
        ]);
      } else {
        await savePlans([{ userId, tagId, assignedData: JSON.stringify(newTarget) }]);
      }
    } catch (e) {
      // Rollback
      setPlansByUser((prev) => {
        const next = structuredClone(prev);
        if (!next[userId]) next[userId] = {};
        next[userId][tagId] = targetData;
        if (sourceTagId) {
          next[userId][sourceTagId] = currentPlans[sourceTagId];
        }
        return next;
      });
      if (e instanceof PlanSaveConflictError) {
        setPlanConflictMessage(e.message);
      } else {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    }
  }

  // ==========================================================
  // Assign ship (with conflict check)
  // ==========================================================
  async function assignShip(userId: string, tagId: string, ship: ShipStock, cellIndex?: number) {
    setError("");

    const currentPlans = plansByUser[userId] ?? {};

    // Find which tag this ship is currently locked to
    let sourceTagId: string | null = null;
    let sourceTagName = "";
    for (const tag of tags) {
      const tagData = currentPlans[tag.id] ?? "[]";
      if (parseAssignments(tagData).some((a) => a && a.uniqueId === ship.uniqueId)) {
        sourceTagId = tag.id;
        sourceTagName = tag.name;
        break;
      }
    }

    // Already in the same tag - skip
    if (sourceTagId === tagId) return;

    // If ship is already in another tag → show conflict dialog
    if (sourceTagId && sourceTagId !== tagId) {
      const targetTagName = tags.find((t) => t.id === tagId)?.name ?? tagId;
      setConflictInfo({
        ship,
        currentTagName: sourceTagName,
        targetTagName,
      });
      pendingAssignmentRef.current = ship;
      setConflictOpen(true);
      return;
    }

    await executeAssign(userId, tagId, ship, cellIndex);
    setPickerOpen(false);
  }

  // ==========================================================
  // Remove ship from a tag
  // ==========================================================
  async function removeShip(userId: string, tagId: string, uniqueId: string) {
    setError("");
    const currentPlans = plansByUser[userId] ?? {};
    const data = currentPlans[tagId] ?? "[]";
    // Set the entry to null instead of removing (preserves grid positions)
    const assignments = parseAssignments(data).map((a) =>
      (a && a.uniqueId === uniqueId) ? null : a,
    );
    // Trim trailing nulls
    while (assignments.length > 0 && assignments[assignments.length - 1] === null) {
      assignments.pop();
    }
    const newData = JSON.stringify(assignments);

    // Optimistic
    setPlansByUser((prev) => {
      const next = structuredClone(prev);
      if (!next[userId]) next[userId] = {};
      next[userId][tagId] = newData;
      return next;
    });

    try {
      await savePlans([{ userId, tagId, assignedData: newData }]);
    } catch (e) {
      // Rollback
      setPlansByUser((prev) => {
        const next = structuredClone(prev);
        if (!next[userId]) next[userId] = {};
        next[userId][tagId] = data;
        return next;
      });
      if (e instanceof PlanSaveConflictError) {
        setPlanConflictMessage(e.message);
      } else {
        setError(e instanceof Error ? e.message : "移除失败");
      }
    }
  }

  // ==========================================================
  // Drag-drop: reorder within same tag
  // ==========================================================
  async function handleReorder(userId: string, tagId: string, newAssignments: (LockAssignment | null)[]) {
    setError("");
    const currentPlans = plansByUser[userId] ?? {};
    const oldData = currentPlans[tagId] ?? "[]";
    const newData = JSON.stringify(newAssignments);

    // Optimistic
    setPlansByUser((prev) => {
      const next = structuredClone(prev);
      if (!next[userId]) next[userId] = {};
      next[userId][tagId] = newData;
      return next;
    });

    try {
      await savePlans([{ userId, tagId, assignedData: newData }]);
    } catch (e) {
      // Rollback
      setPlansByUser((prev) => {
        const next = structuredClone(prev);
        if (!next[userId]) next[userId] = {};
        next[userId][tagId] = oldData;
        return next;
      });
      if (e instanceof PlanSaveConflictError) {
        setPlanConflictMessage(e.message);
      } else {
        setError(e instanceof Error ? e.message : "排序保存失败");
      }
    }
  }

  // ==========================================================
  // Drag-drop: cross-tag move (insert at specific position)
  // ==========================================================
  async function handleDropShip(
    userId: string,
    targetTagId: string,
    uniqueId: string,
    shipId: number,
    sourceTagId: string,
    targetIndex: number,
  ) {
    setError("");

    const currentPlans = plansByUser[userId] ?? {};

    // Target: set dup to null, then insert at exact dropIndex
    const targetData = currentPlans[targetTagId] ?? "[]";
    const targetAssignments = parseAssignments(targetData).map((a) =>
      (a && a.uniqueId === uniqueId) ? null : a,
    );
    // Extend to reach dropIndex
    while (targetAssignments.length <= targetIndex) targetAssignments.push(null);
    targetAssignments[targetIndex] = { uniqueId, shipId };
    // Trim trailing nulls
    while (targetAssignments.length > 0 && targetAssignments[targetAssignments.length - 1] === null) {
      targetAssignments.pop();
    }

    // Source: set to null, trim trailing
    const sourceData = currentPlans[sourceTagId] ?? "[]";
    const newSource = parseAssignments(sourceData).map((a) =>
      (a && a.uniqueId === uniqueId) ? null : a,
    );
    while (newSource.length > 0 && newSource[newSource.length - 1] === null) {
      newSource.pop();
    }

    // Optimistic
    setPlansByUser((prev) => {
      const next = structuredClone(prev);
      if (!next[userId]) next[userId] = {};
      next[userId][targetTagId] = JSON.stringify(targetAssignments);
      next[userId][sourceTagId] = JSON.stringify(newSource);
      return next;
    });

    try {
      await savePlans([
        { userId, tagId: sourceTagId, assignedData: JSON.stringify(newSource) },
        { userId, tagId: targetTagId, assignedData: JSON.stringify(targetAssignments) },
      ]);
    } catch (e) {
      // Rollback
      setPlansByUser((prev) => {
        const next = structuredClone(prev);
        if (!next[userId]) next[userId] = {};
        next[userId][targetTagId] = targetData;
        next[userId][sourceTagId] = sourceData;
        return next;
      });
      if (e instanceof PlanSaveConflictError) {
        setPlanConflictMessage(e.message);
      } else {
        setError(e instanceof Error ? e.message : "移动保存失败");
      }
    }
  }

  // ==========================================================
  // Tag CRUD handlers
  // ==========================================================
  async function handleAddTag(name: string, colorClass: string) {
    const res = await fetch("/api/lock-tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, colorClass, activityId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setTags((prev) => [
      ...prev,
      { id: data.tag.id, name, colorClass, sortOrder: prev.length + 1, isActive: true },
    ]);
  }

  async function handleEditTag(id: string, name: string, colorClass: string) {
    const res = await fetch("/api/lock-tags", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name, colorClass, activityId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name, colorClass } : t)),
    );
  }

  async function handleDeleteTag(id: string) {
    const res = await fetch(`/api/lock-tags?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  // ==========================================================
  // Cell click → open picker
  // ==========================================================
  function openPicker(userId: string, tagId: string, cellIndex: number) {
    setPickerUserId(userId);
    pickerUserIdRef.current = userId;
    setPickerTagId(tagId);
    pickerTagIdRef.current = tagId;
    setPickerCellIndex(cellIndex);
    pickerCellIndexRef.current = cellIndex;
    setPickerOpen(true);
  }

  function handleSelectShip(ship: ShipStock) {
    assignShip(pickerUserIdRef.current, pickerTagIdRef.current, ship, pickerCellIndexRef.current);
  }

  // ==========================================================
  // Map userId -> userName for display
  // ==========================================================
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of initialUsers) {
      map.set(u.userId, u.userName);
    }
    return map;
  }, [initialUsers]);

  const activeTags = tags.filter((t) => t.isActive);

  return (
    <div className="space-y-6">
      {/* Section 1: Header */}
      <div>
        <p className="terminal-label text-xs font-semibold text-primary">LOCK MATRIX / 锁船矩阵</p>
        <h1 className="mt-2 text-2xl font-bold text-white">{activityLabel}锁船矩阵</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {isDailyScope ? "日常锁船分配一览 — 标签颜色全局同步。" : "本期活动独立锁船分配一览 — 标签和计划不会影响其他活动。"}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button type="button" className="ml-3 underline hover:text-red-300" onClick={() => setError("")}>
            关闭
          </button>
        </div>
      )}

      {/* Section 2: Tag Manager */}
      <TagManager
        tags={activeTags}
        onAdd={handleAddTag}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
      />

      {/* Section 3: User rows */}
      <div className="space-y-6">
        {initialUsers.map((user, idx) => {
          // Derive plans from plansByUser state (not from initialUsers) so UI reflects real-time changes
          const userPlansState = plansByUser[user.userId] ?? {};
          const derivedPlans = activeTags
            .filter((tag) => userPlansState[tag.id])
            .map((tag) => {
              const originalPlan = user.plans.find((p) => p.tagId === tag.id);
              return {
                planId: originalPlan?.planId ?? "",
                tagId: tag.id,
                assignedData: userPlansState[tag.id],
                note: originalPlan?.note ?? null,
                updatedAt: originalPlan?.updatedAt ?? "",
              };
            });

          return (
            <div key={user.userId}>
              {idx > 0 && <Separator className="my-4" />}
              <UserLockRow
                userId={user.userId}
                userName={user.userName}
                avatarUrl={user.avatarUrl}
                tags={activeTags}
                plans={derivedPlans}
                ships={shipsByUser[user.userId] ?? []}
                hasShipData={!!user.shipDataRaw?.trim()}
                getShipName={getShipName}
                getShipType={getShipType}
                onCellClick={(_, tagId, cellIndex) => {
                  openPicker(user.userId, tagId, cellIndex);
                }}
                onRemoveShip={(_, tagId, uniqueId) => {
                  removeShip(user.userId, tagId, uniqueId);
                }}
                onReorder={(uid, tagId, newAssignments) => {
                  handleReorder(uid, tagId, newAssignments);
                }}
                onDropShip={(uid, targetTagId, uniqueId, shipId, sourceTagId, targetIndex) => {
                  handleDropShip(uid, targetTagId, uniqueId, shipId, sourceTagId, targetIndex);
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Ship Picker Modal */}
      <ShipPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        ships={pickerUserId ? shipsByUser[pickerUserId] ?? [] : []}
        shipLocks={pickerUserId ? getShipLockMap(pickerUserId) : new Map()}
        getShipName={getShipName}
        getShipType={getShipType}
        getShipTypeId={getShipTypeId}
        onSelectShip={handleSelectShip}
      />

      <AlertDialog
        open={!!planConflictMessage}
        onOpenChange={(open) => {
          if (!open) setPlanConflictMessage("");
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>锁船计划已被更新</AlertDialogTitle>
          <AlertDialogDescription>
            {planConflictMessage || "该锁船规划刚被其他人修改，请刷新页面后再编辑。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPlanConflictMessage("")}>
            稍后刷新
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => window.location.reload()}>
            刷新页面
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>

      {/* Conflict Alert Dialog */}
      <ConflictAlertDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        shipName={conflictInfo ? getShipName(conflictInfo.ship.shipId) : ""}
        currentTagName={conflictInfo?.currentTagName ?? ""}
        targetTagName={conflictInfo?.targetTagName ?? ""}
        onConfirm={async () => {
          if (conflictInfo) {
            await executeAssign(
              pickerUserIdRef.current,
              pickerTagIdRef.current,
              conflictInfo.ship,
              pickerCellIndexRef.current,
            );
          }
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

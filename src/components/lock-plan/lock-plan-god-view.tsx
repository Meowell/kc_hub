"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BonusManager } from "@/components/lock-plan/bonus-manager";
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
import { Panel } from "@/components/ui/panel";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  buildLockMatrixSummary,
  getSaveStatusDisplay,
  getDefaultMobileTagId,
  getTagDisableImpact,
  moveAssignmentBetweenTags,
  parseAssignments,
  type LockAssignment,
  type LockSaveStatus,
} from "@/lib/lock-plan-helpers";
import {
  getBonusGroupsForTag,
  type ActivityBonusConfig,
} from "@/lib/activity-bonus";
import { createMasterLookup, getShipNameFromLookup, getShipTypeFromLookup } from "@/lib/master-data";
import { deriveShipStock, type ShipStock } from "@/lib/noro6";
import { useMasterData } from "@/lib/use-master-data";

// ============================================================
// Types matching API response shape
// ============================================================

type TagDTO = { id: string; name: string; colorClass: string; sortOrder: number; isActive: boolean };
type PlanDTO = { planId: string; tagId: string; assignedData: string; note: string | null; updatedAt: string; version: number };
type UserDTO = { userId: string; userName: string; avatarUrl: string | null; hasShipData: boolean; plans: PlanDTO[] };

type GlobalData = { tags: TagDTO[]; users: UserDTO[] };
type SavedPlanDTO = {
  id: string;
  userId: string;
  tagId: string;
  assignedData: string;
  note: string | null;
  updatedAt: string;
  version: number;
};
type PlanMutation = {
  userId: string;
  tagId: string;
  assignedData: string;
  note?: string | null;
};
type PendingUndo = {
  label: string;
  mutations: PlanMutation[];
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
  currentUserId: string;
  activityLabel: string;
  isDailyScope: boolean;
  initialBonusConfig: ActivityBonusConfig;
  canManageTags?: boolean;
  canEditAllPlans?: boolean;
  initialTagId?: string;
};

export function LockPlanGodView({ initialTags, initialUsers, activityId, currentUserId, activityLabel, isDailyScope, initialBonusConfig, canManageTags = false, canEditAllPlans = false, initialTagId }: LockPlanGodViewProps) {
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
  const getShipOriginalId = useCallback(
    (shipId: number) => masterLookup.origByShipId.get(shipId) ?? shipId,
    [masterLookup],
  );

  // ---- Tag state (optimistic) ----
  const [tags, setTags] = useState<TagDTO[]>(initialTags);
  const [bonusConfig, setBonusConfig] = useState<ActivityBonusConfig>(initialBonusConfig);

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
    Record<string, Record<string, number>>
  >(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const u of initialUsers) {
      map[u.userId] = {};
      for (const p of u.plans) {
        map[u.userId][p.tagId] = p.version;
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
  const [mobileTagId, setMobileTagId] = useState(initialTagId ?? "");
  const [mobileView, setMobileView] = useState<"mine" | "overview" | "conflicts">("mine");
  const [mobileAction, setMobileAction] = useState<{
    uniqueId: string;
    shipId: number;
    tagId: string;
    index: number;
  } | null>(null);

  // ---- Error / saving ----
  const [error, setError] = useState("");
  const [planConflictMessage, setPlanConflictMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<LockSaveStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

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
        next[plan.userId][plan.tagId] = plan.version;
      }
      return next;
    });
  }, []);

  // ==========================================================
  // Save one or two plans with optimistic-concurrency versions
  // ==========================================================
  const savePlans = useCallback(
    async (mutations: PlanMutation[]) => {
      setSaveStatus("saving");
      const payloadPlans = mutations.map((mutation) => {
        const id = planIdsByUser[mutation.userId]?.[mutation.tagId];
        return {
          id,
          userId: mutation.userId,
          tagId: mutation.tagId,
          assignedData: mutation.assignedData,
          note: mutation.note ?? null,
          version: planVersionsByUser[mutation.userId]?.[mutation.tagId],
        };
      });
      const single = payloadPlans.length === 1 ? payloadPlans[0] : null;

      let response: Response;
      let data: { error?: string; plans?: SavedPlanDTO[]; plan?: SavedPlanDTO };
      try {
        response = await fetch("/api/lock-plan", {
          method: single ? (single.id ? "PATCH" : "POST") : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(single ?? { plans: payloadPlans }),
        });
        data = await response.json();
      } catch (e) {
        setSaveStatus("failed");
        throw e instanceof Error ? e : new Error("保存失败");
      }

      if (!response.ok) {
        if (response.status === 409) {
          setSaveStatus("conflict");
          throw new PlanSaveConflictError(data.error ?? "该锁船规划刚被其他人修改，请刷新页面后再编辑");
        }
        setSaveStatus("failed");
        throw new Error(data.error ?? "保存失败");
      }

      const savedPlans: SavedPlanDTO[] = data.plans ?? (data.plan ? [data.plan] : []);
      applySavedPlanVersions(savedPlans);
      setLastSyncedAt(new Date());
      setSaveStatus("synced");
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
    let sourceDataForUndo = "[]";
    if (sourceTagId) {
      const sourceData = currentPlans[sourceTagId] ?? "[]";
      sourceDataForUndo = sourceData;
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
        setPendingUndo({
          label: "撤销移动舰船",
          mutations: [
            { userId, tagId: sourceTagId, assignedData: sourceDataForUndo },
            { userId, tagId, assignedData: targetData },
          ],
        });
      } else {
        await savePlans([{ userId, tagId, assignedData: JSON.stringify(newTarget) }]);
        setPendingUndo({
          label: "撤销分配舰船",
          mutations: [{ userId, tagId, assignedData: targetData }],
        });
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
      setPendingUndo({
        label: "撤销移除舰船",
        mutations: [{ userId, tagId, assignedData: data }],
      });
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
      setPendingUndo({
        label: "撤销排序调整",
        mutations: [{ userId, tagId, assignedData: oldData }],
      });
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

    const targetData = currentPlans[targetTagId] ?? "[]";
    const sourceData = currentPlans[sourceTagId] ?? "[]";
    const {
      sourceAssignments: newSource,
      targetAssignments,
    } = moveAssignmentBetweenTags(
      parseAssignments(sourceData),
      parseAssignments(targetData),
      uniqueId,
      shipId,
      targetIndex,
    );

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
      setPendingUndo({
        label: "撤销移动舰船",
        mutations: [
          { userId, tagId: sourceTagId, assignedData: sourceData },
          { userId, tagId: targetTagId, assignedData: targetData },
        ],
      });
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

  async function undoLastOperation() {
    if (!pendingUndo) return;
    const undo = pendingUndo;
    const previousPlansByUser = plansByUser;

    setError("");
    setPlansByUser((prev) => {
      const next = structuredClone(prev);
      for (const mutation of undo.mutations) {
        if (!next[mutation.userId]) next[mutation.userId] = {};
        next[mutation.userId][mutation.tagId] = mutation.assignedData;
      }
      return next;
    });

    try {
      await savePlans(undo.mutations);
      setPendingUndo(null);
    } catch (e) {
      setPlansByUser(previousPlansByUser);
      if (e instanceof PlanSaveConflictError) {
        setPlanConflictMessage(e.message);
      } else {
        setError(e instanceof Error ? e.message : "撤销失败");
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "停用标签失败");
    }
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

  function closeConflictDialog() {
    setConflictOpen(false);
    setConflictInfo(null);
    pendingAssignmentRef.current = null;
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

  const activeTags = useMemo(() => tags.filter((t) => t.isActive), [tags]);
  const bonusGroupsByTagId = useMemo(
    () =>
      Object.fromEntries(
        activeTags.map((tag) => [tag.id, getBonusGroupsForTag(bonusConfig, tag)]),
      ),
    [activeTags, bonusConfig],
  );
  const currentUser = initialUsers.find((user) => user.userId === currentUserId) ?? initialUsers[0];
  const matrixSummary = useMemo(
    () =>
      buildLockMatrixSummary(
        activeTags,
        initialUsers.map((user) => {
          const userPlansState = plansByUser[user.userId] ?? {};
          return {
            userId: user.userId,
            hasShipData: !!user.shipDataRaw?.trim(),
            plans: activeTags.map((tag) => ({
              tagId: tag.id,
              assignedData: userPlansState[tag.id] ?? "[]",
            })),
          };
        }),
      ),
    [activeTags, initialUsers, plansByUser],
  );
  const saveStatusDisplay = getSaveStatusDisplay(saveStatus, lastSyncedAt);
  const tagDisableImpacts = useMemo(
    () => {
      const users = initialUsers.map((user) => ({
        userId: user.userId,
        plans: activeTags.map((tag) => ({
          tagId: tag.id,
          assignedData: plansByUser[user.userId]?.[tag.id] ?? "[]",
        })),
      }));

      return Object.fromEntries(
        activeTags.map((tag) => [tag.id, getTagDisableImpact(tag.id, users)]),
      );
    },
    [activeTags, initialUsers, plansByUser],
  );

  const currentUserPlans = useMemo(
    () => plansByUser[currentUser?.userId ?? ""] ?? {},
    [currentUser?.userId, plansByUser],
  );

  useEffect(() => {
    if (!currentUser) return;
    setMobileTagId((prev) => {
      if (prev && activeTags.some((tag) => tag.id === prev)) return prev;
      return getDefaultMobileTagId(activeTags, currentUserPlans);
    });
  }, [activeTags, currentUser, currentUserPlans]);

  const selectedMobileTag = activeTags.find((tag) => tag.id === mobileTagId) ?? activeTags[0];

  useEffect(() => {
    if (!initialTagId) return;
    const frame = window.requestAnimationFrame(() => {
      const target = [...document.querySelectorAll<HTMLElement>("[data-lock-tag-id]")]
        .find((element) => element.dataset.lockTagId === initialTagId && element.getClientRects().length > 0);
      target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialTagId]);
  const selectedMobileAssignments = selectedMobileTag
    ? parseAssignments(currentUserPlans[selectedMobileTag.id] ?? "[]")
    : [];
  const selectedMobileBonusGroups = selectedMobileTag ? bonusGroupsByTagId[selectedMobileTag.id] ?? [] : [];
  const selectedMobileShips = useMemo(
    () => currentUser ? shipsByUser[currentUser.userId] ?? [] : [],
    [currentUser, shipsByUser],
  );
  const selectedShipByUniqueId = useMemo(() => {
    const map = new Map<string, ShipStock>();
    for (const ship of selectedMobileShips) {
      map.set(ship.uniqueId, ship);
    }
    return map;
  }, [selectedMobileShips]);

  function openMobilePicker(index: number) {
    if (!currentUser || !selectedMobileTag) return;
    openPicker(currentUser.userId, selectedMobileTag.id, index);
  }

  async function moveMobileShip(targetTagId: string) {
    if (!currentUser || !mobileAction) return;
    const targetAssignments = parseAssignments(currentUserPlans[targetTagId] ?? "[]");
    const targetIndex = targetAssignments.filter(Boolean).length;
    await handleDropShip(
      currentUser.userId,
      targetTagId,
      mobileAction.uniqueId,
      mobileAction.shipId,
      mobileAction.tagId,
      targetIndex,
    );
    setMobileAction(null);
    setMobileTagId(targetTagId);
  }

  async function shiftMobileShip(direction: -1 | 1) {
    if (!currentUser || !mobileAction) return;
    const data = currentUserPlans[mobileAction.tagId] ?? "[]";
    const assignments = parseAssignments(data);
    const targetIndex = mobileAction.index + direction;
    if (targetIndex < 0 || targetIndex >= assignments.length) return;
    const next = [...assignments];
    const tmp = next[mobileAction.index];
    next[mobileAction.index] = next[targetIndex];
    next[targetIndex] = tmp;
    await handleReorder(currentUser.userId, mobileAction.tagId, next);
    setMobileAction({ ...mobileAction, index: targetIndex });
  }

  return (
    <div className="space-y-6">
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
        deleteImpacts={tagDisableImpacts}
        readOnly={!canManageTags}
        onAdd={handleAddTag}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
      />

      {/* Section 3a: Mobile current-user flow */}
      {currentUser && (
        <Panel
          title={`${activityLabel}锁船`}
          status={<StatusBadge variant={matrixSummary.conflictCount ? "danger" : "success"}>{matrixSummary.conflictCount ? `${matrixSummary.conflictCount} 个冲突` : "无冲突"}</StatusBadge>}
          className="md:hidden"
          dense
        >
          <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="移动端锁船视图">
            {([
              ["mine", "我的编辑"],
              ["overview", "全员概览"],
              ["conflicts", "冲突"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mobileView === value}
                onClick={() => setMobileView(value)}
                className={mobileView === value ? "min-h-11 rounded-md border border-primary/60 bg-primary/15 px-2 text-sm font-semibold text-sky-100" : "min-h-11 rounded-md border border-border-base bg-slate-950/30 px-2 text-sm text-slate-300"}
              >
                {label}
              </button>
            ))}
          </div>
          {mobileView === "mine" && (!currentUser.shipDataRaw?.trim() ? (
            <p className="text-sm text-slate-500">当前账号尚未导入 noro6 舰船数据，导入后可在移动端按标签轻量编辑。</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeTags.map((tag) => {
                  const count = parseAssignments(currentUserPlans[tag.id] ?? "[]").filter(Boolean).length;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setMobileTagId(tag.id);
                        setMobileAction(null);
                      }}
                      className={`shrink-0 border px-3 py-2 text-left text-xs font-semibold ${
                        selectedMobileTag?.id === tag.id
                          ? "border-primary bg-primary/15 text-sky-100"
                          : "border-border-base bg-slate-950/25 text-slate-300"
                      }`}
                    >
                      <span className="block">{tag.name}</span>
                      <span className="mt-1 block text-xs text-slate-400">{count} 艘</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {selectedMobileAssignments.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openMobilePicker(0)}
                    className="flex min-h-14 w-full items-center justify-center border border-dashed border-border-base bg-slate-950/25 text-sm font-semibold text-slate-400"
                  >
                    + 选择舰船
                  </button>
                ) : (
                  selectedMobileAssignments.map((assignment, index) => {
                    if (!assignment) {
                      return (
                        <button
                          key={`mobile-empty-${index}`}
                          type="button"
                          onClick={() => openMobilePicker(index)}
                          className="flex min-h-12 w-full items-center justify-center border border-dashed border-border-base bg-slate-950/25 text-xs text-slate-500"
                        >
                          + 空槽位
                        </button>
                      );
                    }
                    const ship = selectedShipByUniqueId.get(assignment.uniqueId);
                    return (
                      <button
                        key={assignment.uniqueId}
                        type="button"
                        onClick={() => setMobileAction({
                          uniqueId: assignment.uniqueId,
                          shipId: assignment.shipId,
                          tagId: selectedMobileTag?.id ?? "",
                          index,
                        })}
                        className="flex min-h-14 w-full items-center justify-between gap-3 border border-border-base bg-slate-950/35 px-3 text-left"
                      >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-100">{getShipName(assignment.shipId)}</span>
                          <span className="terminal-label mt-1 block text-[11px] text-slate-500">
                            Lv.{ship?.level ?? "?"} / {getShipType(assignment.shipId)}
                            {selectedMobileBonusGroups.length > 0 ? ` / ${selectedMobileBonusGroups.length} bonus groups` : ""}
                          </span>
                        </span>
                        <span className="text-xs text-primary">操作</span>
                      </button>
                    );
                  })
                )}
                {selectedMobileAssignments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openMobilePicker(selectedMobileAssignments.length)}
                    className="flex min-h-12 w-full items-center justify-center border border-dashed border-primary/35 bg-primary/10 text-xs font-semibold text-sky-100"
                  >
                    + 追加舰船
                  </button>
                )}
              </div>
            </div>
          ))}
          {mobileView === "overview" && (
            <div className="space-y-2">
              {initialUsers.map((user) => {
                const assignedCount = activeTags.reduce((count, tag) => count + parseAssignments(plansByUser[user.userId]?.[tag.id] ?? "[]").filter(Boolean).length, 0);
                return (
                  <details key={user.userId} className="rounded-md border border-border-base bg-slate-950/30">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-slate-100">
                      <span className="truncate">{user.userName}</span>
                      <span className="text-xs font-normal text-slate-400">{assignedCount} 艘</span>
                    </summary>
                    <div className="space-y-2 border-t border-border-base p-3">
                      {activeTags.map((tag) => {
                        const assignments = parseAssignments(plansByUser[user.userId]?.[tag.id] ?? "[]").filter((item): item is LockAssignment => !!item);
                        return (
                          <div key={tag.id} className="rounded-md bg-slate-900/70 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-200">{tag.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{assignments.length ? assignments.map((item) => getShipName(item.shipId)).join("、") : "尚未分配"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          {mobileView === "conflicts" && (
            <div className="space-y-2">
              {matrixSummary.conflicts.length === 0 ? (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-4 text-sm text-emerald-200">当前没有重复锁船冲突。</p>
              ) : matrixSummary.conflicts.map((conflict) => (
                <button
                  key={`${conflict.userId}-${conflict.uniqueId}`}
                  type="button"
                  onClick={() => setMobileView("overview")}
                  className="min-h-14 w-full rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-left"
                >
                  <span className="block text-sm font-semibold text-red-100">{getShipName(conflict.shipId)}</span>
                  <span className="mt-1 block text-xs text-red-200/80">
                    {initialUsers.find((user) => user.userId === conflict.userId)?.userName ?? "未知成员"} · {conflict.tagIds.map((tagId) => activeTags.find((tag) => tag.id === tagId)?.name ?? tagId).join(" / ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Section 3: User rows */}
      <div className="hidden space-y-6 md:block">
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
                version: originalPlan?.version ?? 1,
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
                bonusGroupsByTagId={bonusGroupsByTagId}
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
                readOnly={!canEditAllPlans && user.userId !== currentUserId}
                highlightTagId={initialTagId}
              />
            </div>
          );
        })}
      </div>

      {/* Section 4: Summary and bonus tools */}
      <Panel
        eyebrow="LOCK MATRIX"
        title={`${activityLabel}锁船矩阵`}
        status={<StatusBadge variant={saveStatusDisplay.variant}>{saveStatusDisplay.label}</StatusBadge>}
        actions={pendingUndo ? (
          <button
            type="button"
            onClick={undoLastOperation}
            className="border border-border-base bg-slate-950/35 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-primary/60 hover:text-sky-100"
          >
            {pendingUndo.label}
          </button>
        ) : null}
        dense
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-sm text-slate-400">
              {isDailyScope ? "日常锁船分配一览，标签颜色全局同步。" : "本期活动独立锁船分配一览，标签和计划不会影响其他活动。"}
            </p>
            <p className="mt-2 text-xs text-slate-500">{saveStatusDisplay.detail}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">TAGS</p>
              <p className="text-lg font-semibold text-white">{matrixSummary.activeTagCount}</p>
            </div>
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">ASSIGNED</p>
              <p className="text-lg font-semibold text-white">{matrixSummary.assignedShipCount}</p>
            </div>
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">CONFLICT</p>
              <p className={matrixSummary.conflictCount > 0 ? "text-lg font-semibold text-red-200" : "text-lg font-semibold text-emerald-200"}>
                {matrixSummary.conflictCount}
              </p>
            </div>
            <div className="border border-border-base bg-slate-950/30 px-3 py-2">
              <p className="terminal-label text-[10px] text-slate-500">NO DATA</p>
              <p className={matrixSummary.missingShipDataCount > 0 ? "text-lg font-semibold text-amber-200" : "text-lg font-semibold text-emerald-200"}>
                {matrixSummary.missingShipDataCount}
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <BonusManager
        activityId={activityId}
        tags={activeTags}
        config={bonusConfig}
        canManage={canManageTags}
        getShipName={getShipName}
        onConfigChange={setBonusConfig}
      />

      {/* Ship Picker Modal */}
      <ShipPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        ships={pickerUserId ? shipsByUser[pickerUserId] ?? [] : []}
        shipLocks={pickerUserId ? getShipLockMap(pickerUserId) : new Map()}
        bonusGroups={pickerTagId ? bonusGroupsByTagId[pickerTagId] ?? [] : []}
        getShipName={getShipName}
        getShipType={getShipType}
        getShipTypeId={getShipTypeId}
        getShipOriginalId={getShipOriginalId}
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

      <AlertDialog
        open={!!mobileAction}
        onOpenChange={(open) => {
          if (!open) setMobileAction(null);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>锁船操作</AlertDialogTitle>
          <AlertDialogDescription>
            {mobileAction ? `${getShipName(mobileAction.shipId)} / ${getShipType(mobileAction.shipId)}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => shiftMobileShip(-1)}
              className="border border-border-base bg-slate-950/35 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
              disabled={!mobileAction || mobileAction.index <= 0}
            >
              上移
            </button>
            <button
              type="button"
              onClick={() => shiftMobileShip(1)}
              className="border border-border-base bg-slate-950/35 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
              disabled={!mobileAction || mobileAction.index >= selectedMobileAssignments.length - 1}
            >
              下移
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {activeTags
              .filter((tag) => tag.id !== mobileAction?.tagId)
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => moveMobileShip(tag.id)}
                  className="border border-border-base bg-slate-950/35 px-3 py-2 text-sm text-slate-200"
                >
                  移动到 {tag.name}
                </button>
              ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!currentUser || !mobileAction) return;
              await removeShip(currentUser.userId, mobileAction.tagId, mobileAction.uniqueId);
              setMobileAction(null);
            }}
            className="w-full border border-danger/60 bg-danger/15 px-3 py-2 text-sm font-semibold text-red-100"
          >
            移除舰船
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setMobileAction(null)}>
            关闭
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialog>

      {/* Conflict Alert Dialog */}
      <ConflictAlertDialog
        open={conflictOpen}
        onOpenChange={(open) => {
          if (open) {
            setConflictOpen(true);
          } else {
            closeConflictDialog();
          }
        }}
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
          closeConflictDialog();
        }}
      />
    </div>
  );
}

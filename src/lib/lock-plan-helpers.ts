import { shipTypeLabels, type ShipMaster } from "@/lib/master-data";

// ============================================================
// Shared helpers for lock-plan components
// Extracted from old lock-plan-board.tsx to be reusable by
// the new God-view components.
// ============================================================

export type LockAssignment = {
  uniqueId: string;
  shipId: number;
};

export const shipMasters: ShipMaster[] = [];
export const masterByShipId = new Map<number, ShipMaster>();
export { shipTypeLabels };

export function getShipName(shipId: number) {
  return `未知舰船 ${shipId}`;
}

export function getShipType(_shipId: number) {
  return "Type ?";
}

export function parseAssignments(value: string): (LockAssignment | null)[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): LockAssignment | null => {
      if (item === null) return null;
      if (
        item &&
        typeof item === "object" &&
        typeof item.uniqueId === "string" &&
        Number.isInteger(item.shipId)
      ) {
        return { uniqueId: item.uniqueId, shipId: item.shipId };
      }
      return null;
    });
  } catch {
    return [];
  }
}

export function reorderAssignmentWithinTag(
  assignments: (LockAssignment | null)[],
  uniqueId: string,
  shipId: number,
  dropIndex: number,
) {
  const sourceIndex = assignments.findIndex((assignment) => assignment?.uniqueId === uniqueId);
  if (sourceIndex < 0 || dropIndex < 0 || sourceIndex === dropIndex) return assignments;

  const next = [...assignments];
  while (next.length <= Math.max(sourceIndex, dropIndex)) next.push(null);

  const target = next[dropIndex] ?? null;
  next[dropIndex] = { uniqueId, shipId };
  next[sourceIndex] = target;

  while (next.length > 0 && next[next.length - 1] === null) {
    next.pop();
  }

  return next;
}

export function moveAssignmentBetweenTags(
  sourceAssignments: (LockAssignment | null)[],
  targetAssignments: (LockAssignment | null)[],
  uniqueId: string,
  shipId: number,
  targetIndex: number,
) {
  const sourceIndex = sourceAssignments.findIndex((assignment) => assignment?.uniqueId === uniqueId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return { sourceAssignments, targetAssignments };
  }

  const nextSource = [...sourceAssignments];
  const nextTarget = targetAssignments.map((assignment) =>
    assignment?.uniqueId === uniqueId ? null : assignment,
  );
  while (nextTarget.length <= targetIndex) nextTarget.push(null);

  const target = nextTarget[targetIndex] ?? null;
  nextTarget[targetIndex] = { uniqueId, shipId };
  nextSource[sourceIndex] = target;

  while (nextTarget.length > 0 && nextTarget[nextTarget.length - 1] === null) {
    nextTarget.pop();
  }
  while (nextSource.length > 0 && nextSource[nextSource.length - 1] === null) {
    nextSource.pop();
  }

  return {
    sourceAssignments: nextSource,
    targetAssignments: nextTarget,
  };
}

export type LockMatrixSummaryTag = {
  id: string;
  isActive?: boolean;
};

export type LockMatrixSummaryPlan = {
  tagId: string;
  assignedData: string;
};

export type LockMatrixPlanOwner = {
  userId: string;
  plans: LockMatrixSummaryPlan[];
};

export type LockMatrixSummaryUser = {
  userId: string;
  hasShipData: boolean;
  plans: LockMatrixSummaryPlan[];
};

export type LockMatrixConflict = {
  userId: string;
  uniqueId: string;
  shipId: number;
  tagIds: string[];
};

export type LockMatrixSummary = {
  activeTagCount: number;
  assignedShipCount: number;
  missingShipDataCount: number;
  conflictCount: number;
  conflicts: LockMatrixConflict[];
};

export function buildLockMatrixSummary(
  tags: LockMatrixSummaryTag[],
  users: LockMatrixSummaryUser[],
): LockMatrixSummary {
  const activeTagIds = new Set(
    tags.filter((tag) => tag.isActive !== false).map((tag) => tag.id),
  );
  let assignedShipCount = 0;
  let missingShipDataCount = 0;
  const conflicts: LockMatrixConflict[] = [];

  for (const user of users) {
    if (!user.hasShipData) {
      missingShipDataCount += 1;
    }

    const assignmentsByUniqueId = new Map<
      string,
      { shipId: number; tagIds: string[] }
    >();

    for (const plan of user.plans) {
      if (!activeTagIds.has(plan.tagId)) continue;

      for (const assignment of parseAssignments(plan.assignedData)) {
        if (!assignment) continue;
        assignedShipCount += 1;

        const current = assignmentsByUniqueId.get(assignment.uniqueId);
        if (current) {
          if (!current.tagIds.includes(plan.tagId)) {
            current.tagIds.push(plan.tagId);
          }
        } else {
          assignmentsByUniqueId.set(assignment.uniqueId, {
            shipId: assignment.shipId,
            tagIds: [plan.tagId],
          });
        }
      }
    }

    for (const [uniqueId, assignment] of assignmentsByUniqueId) {
      if (assignment.tagIds.length > 1) {
        conflicts.push({
          userId: user.userId,
          uniqueId,
          shipId: assignment.shipId,
          tagIds: assignment.tagIds,
        });
      }
    }
  }

  return {
    activeTagCount: activeTagIds.size,
    assignedShipCount,
    missingShipDataCount,
    conflictCount: conflicts.length,
    conflicts,
  };
}

export type LockSaveStatus = "idle" | "saving" | "synced" | "failed" | "conflict";

export type LockSaveStatusDisplay = {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "muted";
  detail: string;
};

function formatClockTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export function getSaveStatusDisplay(
  status: LockSaveStatus,
  lastSyncedAt?: Date | null,
): LockSaveStatusDisplay {
  if (status === "saving") {
    return {
      label: "SAVING / 同步中",
      variant: "warning",
      detail: "正在同步锁船计划",
    };
  }

  if (status === "synced") {
    return {
      label: "SYNCED / 已同步",
      variant: "success",
      detail: lastSyncedAt ? `最近同步 ${formatClockTime(lastSyncedAt)}` : "锁船计划已同步",
    };
  }

  if (status === "failed") {
    return {
      label: "FAILED / 同步失败",
      variant: "danger",
      detail: "同步失败，请重试",
    };
  }

  if (status === "conflict") {
    return {
      label: "CONFLICT / 冲突",
      variant: "danger",
      detail: "锁船计划已被更新，请刷新后再编辑",
    };
  }

  return {
    label: "READY / 就绪",
    variant: "muted",
    detail: "等待锁船操作",
  };
}

export type TagDisableImpact = {
  planCount: number;
  assignedShipCount: number;
  affectedUserIds: string[];
};

export function getTagDisableImpact(
  tagId: string,
  users: LockMatrixPlanOwner[],
): TagDisableImpact {
  let planCount = 0;
  let assignedShipCount = 0;
  const affectedUserIds: string[] = [];

  for (const user of users) {
    const plans = user.plans.filter((plan) => plan.tagId === tagId);
    if (plans.length === 0) continue;

    let userAssignedCount = 0;
    for (const plan of plans) {
      const assignedCount = parseAssignments(plan.assignedData).filter(Boolean).length;
      userAssignedCount += assignedCount;
      assignedShipCount += assignedCount;
      planCount += 1;
    }

    if (userAssignedCount > 0 || plans.length > 0) {
      affectedUserIds.push(user.userId);
    }
  }

  return {
    planCount,
    assignedShipCount,
    affectedUserIds,
  };
}

export function getDefaultMobileTagId(
  tags: LockMatrixSummaryTag[],
  plansByTagId: Record<string, string>,
): string {
  const activeTags = tags.filter((tag) => tag.isActive !== false);
  const tagWithAssignments = activeTags.find((tag) =>
    parseAssignments(plansByTagId[tag.id] ?? "[]").some(Boolean),
  );

  return tagWithAssignments?.id ?? activeTags[0]?.id ?? "";
}

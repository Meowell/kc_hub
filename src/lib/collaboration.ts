export type UserRole = "member" | "planner" | "admin";

export type ActorLike = {
  id: string;
  role?: string | null;
};

export type ActivityStateLike = {
  status?: string | null;
  isActive?: boolean | null;
} | null;

export function normalizeRole(role?: string | null): UserRole {
  if (role === "admin" || role === "planner" || role === "member") return role;
  return "member";
}

export function getRoleLabel(role?: string | null) {
  return normalizeRole(role).toUpperCase();
}

export function canManageSharedResource(actor: ActorLike) {
  const role = normalizeRole(actor.role);
  return role === "planner" || role === "admin";
}

export function canEditOwnedResource(actor: ActorLike, ownerId: string) {
  return actor.id === ownerId || canManageSharedResource(actor);
}

export function isActivityWritable(activity: ActivityStateLike) {
  if (!activity) return true;
  if (activity.isActive === false) return false;
  return activity.status !== "archived" && activity.status !== "hidden";
}

export function getVisibleContentWhere<T extends Record<string, unknown>>(where: T) {
  return {
    ...where,
    isDeleted: false,
  };
}

export function getActivityArchiveData() {
  return {
    status: "archived",
    isActive: true,
  };
}

export function isLockPlanVersionConflict(currentVersion: number, knownVersion?: number) {
  return knownVersion === undefined || currentVersion !== knownVersion;
}

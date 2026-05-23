import { z } from "zod";

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN 必须是 4 位数字");
export const userNameSchema = z.string().trim().min(1, "用户名不能为空").max(30, "用户名不能超过 30 个字符");

export const loginSchema = z.object({
  name: userNameSchema,
  pinCode: pinSchema,
});

export const registerSchema = z.object({
  name: userNameSchema,
  pinCode: pinSchema,
});

export const shipDataSchema = z.object({
  shipData: z.string().min(2).max(8 * 1024 * 1024),
});

export const routineRecordSchema = z.object({
  id: z.string().optional(),
  seaArea: z.string().min(1).max(50),
  missionName: z.string().min(1).max(100),
  airControl: z.coerce.number().int().min(0).max(9999).optional().default(0),
  note: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  fleetData: z.string().max(100000).optional().nullable(),
});

export const strategyPostSchema = z.object({
  id: z.string().optional(),
  phaseName: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(20000),
  fleetImageUrl: z.string().max(500).optional().nullable(),
  airbaseImageUrl: z.string().max(500).optional().nullable(),
  routineCardIds: z.string().max(500).optional().nullable(),
});

export const tagColorClasses = [
  "bg-red-200",
  "bg-orange-200",
  "bg-amber-200",
  "bg-yellow-200",
  "bg-lime-200",
  "bg-green-200",
  "bg-emerald-200",
  "bg-teal-200",
  "bg-cyan-200",
  "bg-blue-200",
  "bg-indigo-200",
  "bg-purple-200",
  "bg-pink-200",
  "bg-rose-200",
] as const;

export const lockAssignmentSchema = z.object({
  uniqueId: z.string().min(1).max(80),
  shipId: z.number().int().positive(),
});

export function assertLockAssignmentsString(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    // Allow null entries (for gaps between ships in drag reorder)
    return parsed.every((item) => {
      if (item === null) return true;
      return lockAssignmentSchema.safeParse(item).success;
    });
  } catch {
    return false;
  }
}

export const lockTagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
  colorClass: z.enum(tagColorClasses),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const lockPlanSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  tagId: z.string().min(1),
  assignedData: z.string().min(2).max(2 * 1024 * 1024),
  note: z.string().max(2000).optional().nullable(),
  updatedAt: z.string().datetime().optional(),
});

export const lockPlanBatchSchema = z.object({
  plans: z.array(lockPlanSchema).min(1).max(2),
});

export function assertJsonString(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

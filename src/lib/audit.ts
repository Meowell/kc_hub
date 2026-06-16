import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  activityId?: string | null;
  before?: unknown;
  after?: unknown;
};

function toJson(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      activityId: input.activityId ?? null,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
    },
  });
}

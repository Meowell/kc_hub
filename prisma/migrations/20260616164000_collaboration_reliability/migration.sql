-- Phase 5 collaboration reliability foundation.

ALTER TABLE "RoutineRecord" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoutineRecord" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RoutineRecord" ADD COLUMN "copiedFromId" TEXT;

ALTER TABLE "StrategyPost" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StrategyPost" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StrategyPost" ADD COLUMN "updatedById" TEXT;

ALTER TABLE "LockPlan" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LockPlan" ADD COLUMN "updatedById" TEXT;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "activityId" TEXT,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RoutineRecord_activityId_isDeleted_isPinned_idx" ON "RoutineRecord"("activityId", "isDeleted", "isPinned");
CREATE INDEX "StrategyPost_activityId_isDeleted_isPinned_idx" ON "StrategyPost"("activityId", "isDeleted", "isPinned");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_activityId_createdAt_idx" ON "AuditLog"("activityId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

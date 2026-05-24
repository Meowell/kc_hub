-- Add activity spaces. Existing records remain in the default daily space
-- with activityId = NULL and LockTag.scopeKey = 'daily'.

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_LockTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT 'daily',
    "name" TEXT NOT NULL,
    "colorClass" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LockTag_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LockTag" ("colorClass", "createdAt", "id", "isActive", "name", "sortOrder", "updatedAt")
SELECT "colorClass", "createdAt", "id", "isActive", "name", "sortOrder", "updatedAt" FROM "LockTag";
DROP TABLE "LockTag";
ALTER TABLE "new_LockTag" RENAME TO "LockTag";
CREATE INDEX "LockTag_activityId_sortOrder_idx" ON "LockTag"("activityId", "sortOrder");
CREATE UNIQUE INDEX "LockTag_scopeKey_name_key" ON "LockTag"("scopeKey", "name");

CREATE TABLE "new_RoutineRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" TEXT,
    "seaArea" TEXT NOT NULL,
    "missionName" TEXT NOT NULL,
    "airControl" INTEGER NOT NULL,
    "note" TEXT,
    "imageUrl" TEXT,
    "fleetData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutineRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutineRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoutineRecord" ("airControl", "createdAt", "fleetData", "id", "imageUrl", "missionName", "note", "seaArea", "updatedAt", "userId")
SELECT "airControl", "createdAt", "fleetData", "id", "imageUrl", "missionName", "note", "seaArea", "updatedAt", "userId" FROM "RoutineRecord";
DROP TABLE "RoutineRecord";
ALTER TABLE "new_RoutineRecord" RENAME TO "RoutineRecord";
CREATE INDEX "RoutineRecord_activityId_idx" ON "RoutineRecord"("activityId");
CREATE INDEX "RoutineRecord_userId_seaArea_idx" ON "RoutineRecord"("userId", "seaArea");
CREATE INDEX "RoutineRecord_createdAt_idx" ON "RoutineRecord"("createdAt");

CREATE TABLE "new_StrategyPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" TEXT,
    "phaseName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fleetImageUrl" TEXT,
    "airbaseImageUrl" TEXT,
    "routineCardIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyPost_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrategyPost" ("airbaseImageUrl", "content", "createdAt", "fleetImageUrl", "id", "phaseName", "routineCardIds", "title", "updatedAt", "userId")
SELECT "airbaseImageUrl", "content", "createdAt", "fleetImageUrl", "id", "phaseName", "routineCardIds", "title", "updatedAt", "userId" FROM "StrategyPost";
DROP TABLE "StrategyPost";
ALTER TABLE "new_StrategyPost" RENAME TO "StrategyPost";
CREATE INDEX "StrategyPost_activityId_idx" ON "StrategyPost"("activityId");
CREATE INDEX "StrategyPost_userId_idx" ON "StrategyPost"("userId");
CREATE INDEX "StrategyPost_phaseName_idx" ON "StrategyPost"("phaseName");
CREATE INDEX "StrategyPost_createdAt_idx" ON "StrategyPost"("createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "Activity_name_key" ON "Activity"("name");
CREATE INDEX "Activity_isActive_sortOrder_idx" ON "Activity"("isActive", "sortOrder");

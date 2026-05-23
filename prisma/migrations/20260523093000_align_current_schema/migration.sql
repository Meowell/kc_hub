-- Bring the original init migration up to the current application schema.
-- This keeps old local databases migratable while preserving existing user data where possible.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- User profile/game fields added after the initial schema.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "backgroundUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "food" INTEGER NOT NULL DEFAULT 0;

-- Fleet payload for routine records.
ALTER TABLE "RoutineRecord" ADD COLUMN "fleetData" TEXT;

-- Daily check-in records.
CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DailyCheckIn_userId_idx" ON "DailyCheckIn"("userId");
CREATE UNIQUE INDEX "DailyCheckIn_userId_date_key" ON "DailyCheckIn"("userId", "date");

-- Global lock tags extracted from the old per-plan tag fields.
CREATE TABLE "LockTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "colorClass" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "LockTag" ("id", "name", "colorClass", "sortOrder", "updatedAt")
SELECT lower(hex(randomblob(16))), "tagName", COALESCE(MIN("tagColorClass"), 'bg-blue-200'), 0, CURRENT_TIMESTAMP
FROM "LockPlan"
GROUP BY "tagName";

CREATE UNIQUE INDEX "LockTag_name_key" ON "LockTag"("name");

-- Lock plans now reference LockTag by id instead of embedding tag metadata.
CREATE TABLE "new_LockPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedData" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LockPlan_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LockTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LockPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_LockPlan" ("id", "userId", "tagId", "assignedData", "note", "createdAt", "updatedAt")
SELECT lp."id", lp."userId", lt."id", lp."assignedData", lp."note", lp."createdAt", lp."updatedAt"
FROM "LockPlan" lp
JOIN "LockTag" lt ON lt."name" = lp."tagName";

DROP TABLE "LockPlan";
ALTER TABLE "new_LockPlan" RENAME TO "LockPlan";
CREATE INDEX "LockPlan_userId_idx" ON "LockPlan"("userId");
CREATE INDEX "LockPlan_tagId_idx" ON "LockPlan"("tagId");
CREATE UNIQUE INDEX "LockPlan_userId_tagId_key" ON "LockPlan"("userId", "tagId");

-- Strategy posts became user-owned and can link routine cards.
CREATE TABLE "new_StrategyPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phaseName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fleetImageUrl" TEXT,
    "airbaseImageUrl" TEXT,
    "routineCardIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_StrategyPost" (
    "id", "userId", "phaseName", "title", "content", "fleetImageUrl", "airbaseImageUrl", "createdAt", "updatedAt"
)
SELECT
    "id",
    (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1),
    "phaseName",
    "title",
    "content",
    "fleetImageUrl",
    "airbaseImageUrl",
    "createdAt",
    "updatedAt"
FROM "StrategyPost"
WHERE (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) IS NOT NULL;

DROP TABLE "StrategyPost";
ALTER TABLE "new_StrategyPost" RENAME TO "StrategyPost";
CREATE INDEX "StrategyPost_userId_idx" ON "StrategyPost"("userId");
CREATE INDEX "StrategyPost_phaseName_idx" ON "StrategyPost"("phaseName");
CREATE INDEX "StrategyPost_createdAt_idx" ON "StrategyPost"("createdAt");

-- Mini-game leaderboard.
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GameScore_gameType_score_idx" ON "GameScore"("gameType", "score" DESC);
CREATE INDEX "GameScore_userId_idx" ON "GameScore"("userId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

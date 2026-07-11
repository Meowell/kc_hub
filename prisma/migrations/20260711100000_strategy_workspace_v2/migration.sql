CREATE TABLE "StrategyMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOpenForPosts" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyMap_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StrategySection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyMapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategySection_strategyMapId_fkey" FOREIGN KEY ("strategyMapId") REFERENCES "StrategyMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StrategySectionLockTag" (
    "sectionId" TEXT NOT NULL,
    "lockTagId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("sectionId", "lockTagId"),
    CONSTRAINT "StrategySectionLockTag_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "StrategySection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategySectionLockTag_lockTagId_fkey" FOREIGN KEY ("lockTagId") REFERENCES "LockTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StrategyAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyPostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyAsset_strategyPostId_fkey" FOREIGN KEY ("strategyPostId") REFERENCES "StrategyPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StrategyRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyPostId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentFormat" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyRevision_strategyPostId_fkey" FOREIGN KEY ("strategyPostId") REFERENCES "StrategyPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_StrategyPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" TEXT,
    "sectionId" TEXT,
    "phaseName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentFormat" TEXT NOT NULL DEFAULT 'markdown',
    "status" TEXT NOT NULL DEFAULT 'published',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "plainText" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "fleetImageUrl" TEXT,
    "airbaseImageUrl" TEXT,
    "routineCardIds" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyPost_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrategyPost_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "StrategySection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_StrategyPost" (
    "activityId", "airbaseImageUrl", "content", "createdAt", "fleetImageUrl", "id",
    "isDeleted", "isPinned", "phaseName", "publishedAt", "routineCardIds", "title",
    "updatedAt", "updatedById", "userId"
)
SELECT
    "activityId", "airbaseImageUrl", "content", "createdAt", "fleetImageUrl", "id",
    "isDeleted", "isPinned", "phaseName", "updatedAt", "routineCardIds", "title",
    "updatedAt", "updatedById", "userId"
FROM "StrategyPost";

DROP TABLE "StrategyPost";
ALTER TABLE "new_StrategyPost" RENAME TO "StrategyPost";

CREATE INDEX "StrategyPost_activityId_idx" ON "StrategyPost"("activityId");
CREATE INDEX "StrategyPost_sectionId_status_updatedAt_idx" ON "StrategyPost"("sectionId", "status", "updatedAt");
CREATE INDEX "StrategyPost_activityId_isDeleted_isPinned_idx" ON "StrategyPost"("activityId", "isDeleted", "isPinned");
CREATE INDEX "StrategyPost_userId_idx" ON "StrategyPost"("userId");
CREATE INDEX "StrategyPost_phaseName_idx" ON "StrategyPost"("phaseName");
CREATE INDEX "StrategyPost_createdAt_idx" ON "StrategyPost"("createdAt");
CREATE UNIQUE INDEX "StrategyPost_sectionId_userId_key" ON "StrategyPost"("sectionId", "userId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE INDEX "StrategyMap_activityId_isDeleted_sortOrder_idx" ON "StrategyMap"("activityId", "isDeleted", "sortOrder");
CREATE UNIQUE INDEX "StrategyMap_activityId_code_key" ON "StrategyMap"("activityId", "code");
CREATE INDEX "StrategySection_strategyMapId_isDeleted_sortOrder_idx" ON "StrategySection"("strategyMapId", "isDeleted", "sortOrder");
CREATE UNIQUE INDEX "StrategySection_strategyMapId_name_key" ON "StrategySection"("strategyMapId", "name");
CREATE INDEX "StrategySectionLockTag_lockTagId_idx" ON "StrategySectionLockTag"("lockTagId");
CREATE UNIQUE INDEX "StrategyAsset_url_key" ON "StrategyAsset"("url");
CREATE INDEX "StrategyAsset_strategyPostId_createdAt_idx" ON "StrategyAsset"("strategyPostId", "createdAt");
CREATE INDEX "StrategyAsset_userId_createdAt_idx" ON "StrategyAsset"("userId", "createdAt");
CREATE INDEX "StrategyRevision_strategyPostId_createdAt_idx" ON "StrategyRevision"("strategyPostId", "createdAt");
CREATE UNIQUE INDEX "StrategyRevision_strategyPostId_revision_key" ON "StrategyRevision"("strategyPostId", "revision");

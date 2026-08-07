CREATE TABLE "RoutineCollectionProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutineCollectionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoutineCollectionProgress_userId_collectionKey_stepKey_key"
ON "RoutineCollectionProgress"("userId", "collectionKey", "stepKey");

CREATE INDEX "RoutineCollectionProgress_userId_collectionKey_idx"
ON "RoutineCollectionProgress"("userId", "collectionKey");

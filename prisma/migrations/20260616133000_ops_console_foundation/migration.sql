-- Add low-risk foundation fields for the operations console rollout.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "User" ADD COLUMN "lastShipDataUpdatedAt" DATETIME;
ALTER TABLE "Activity" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

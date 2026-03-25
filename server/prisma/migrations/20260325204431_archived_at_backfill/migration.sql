-- AlterTable
ALTER TABLE "spools" ADD COLUMN "archived_at" DATETIME;

-- Backfill: archivedAt for legacy archived spools
UPDATE "spools"
SET "archived_at" = CURRENT_TIMESTAMP
WHERE "is_archived" = 1
  AND "archived_at" IS NULL;

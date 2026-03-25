/*
  Warnings:

  - You are about to drop the column `is_archived` on the `spools` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_spools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filament_type" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "color_hex" TEXT,
    "manufacturer" TEXT,
    "initial_weight" REAL NOT NULL,
    "remaining_weight" REAL NOT NULL,
    "spool_weight" REAL,
    "diameter" REAL NOT NULL DEFAULT 1.75,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" DATETIME,
    "expiration_date" DATETIME,
    "purchase_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_spools" ("archived_at", "color", "color_hex", "created_at", "diameter", "expiration_date", "filament_type", "id", "initial_weight", "is_active", "manufacturer", "name", "notes", "purchase_date", "remaining_weight", "spool_weight", "updated_at") SELECT "archived_at", "color", "color_hex", "created_at", "diameter", "expiration_date", "filament_type", "id", "initial_weight", "is_active", "manufacturer", "name", "notes", "purchase_date", "remaining_weight", "spool_weight", "updated_at" FROM "spools";
DROP TABLE "spools";
ALTER TABLE "new_spools" RENAME TO "spools";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

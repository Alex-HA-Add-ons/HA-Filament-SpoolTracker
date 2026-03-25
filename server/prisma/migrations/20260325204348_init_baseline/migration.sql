-- Baseline (safe for existing DBs): Prisma omitted `IF NOT EXISTS` originally,
-- but we use it here to avoid failing on databases that already have the tables.

-- CreateTable
CREATE TABLE IF NOT EXISTS "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "spools" (
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
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "expiration_date" DATETIME,
    "purchase_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "printers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ha_device_id" TEXT NOT NULL,
    "entity_prefix" TEXT NOT NULL,
    "model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "active_spool_id" TEXT,
    "entity_print_status" TEXT,
    "entity_task_name" TEXT,
    "entity_print_weight" TEXT,
    "entity_cover_image" TEXT,
    "entity_print_start" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "printers_active_spool_id_fkey" FOREIGN KEY ("active_spool_id") REFERENCES "spools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "print_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printer_id" TEXT,
    "spool_id" TEXT,
    "project_name" TEXT NOT NULL,
    "project_image" TEXT,
    "filament_used" REAL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "progress" REAL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "print_jobs_spool_id_fkey" FOREIGN KEY ("spool_id") REFERENCES "spools" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "printers_ha_device_id_key" ON "printers"("ha_device_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "printers_active_spool_id_key" ON "printers"("active_spool_id");

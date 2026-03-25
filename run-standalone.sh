#!/bin/bash
# Run the add-on outside Hass.io (e.g. Docker on another host) while still connecting to Home Assistant.
# Requires: HOME_ASSISTANT_URL, SUPERVISOR_TOKEN (or SUPERVISOR_TOKEN_FILE with a path to a file containing the token).
# When using the HA base image, run with: docker run --entrypoint "" ... /run-standalone.sh
#   so env vars are not stripped by the base image's /init entrypoint.

set -e

# Optional: read token from file (avoids passing secret on command line; use -e SUPERVISOR_TOKEN_FILE=/run/token and mount the file)
if [ -z "$SUPERVISOR_TOKEN" ] && [ -n "$SUPERVISOR_TOKEN_FILE" ] && [ -f "$SUPERVISOR_TOKEN_FILE" ]; then
  export SUPERVISOR_TOKEN="$(cat "$SUPERVISOR_TOKEN_FILE")"
fi

export NODE_ENV=production
export HOME_ASSISTANT=true
export PORT="${PORT:-3000}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export ADDON_VERSION="${ADDON_VERSION:-0.0.0}"
export APP_ROOT="${APP_ROOT:-/app}"
export SERVER_PATH="${SERVER_PATH:-/app/server}"
export CLIENT_PATH="${CLIENT_PATH:-/app/client}"
export DATABASE_URL="${DATABASE_URL:-file:/data/app.db}"

cd "$APP_ROOT"

echo "Starting HA Filament SpoolTracker v${ADDON_VERSION} (standalone)..."
echo "Port: $PORT | Database: $DATABASE_URL"
if [ -n "$HOME_ASSISTANT_URL" ]; then
  echo "HA URL: $HOME_ASSISTANT_URL"
else
  echo "HOME_ASSISTANT_URL not set — HA integration will be disabled (set it to connect to HA)"
fi
if [ -n "$SUPERVISOR_TOKEN" ]; then
  echo "HA token: set"
else
  echo "SUPERVISOR_TOKEN not set — HA integration will be disabled"
fi

# Prisma migrate deploy applies pending migrations in order. Databases created before we used
# Migrate (e.g. only db push) already have tables but often no _prisma_migrations history; the
# first deploy then fails with P3005 ("schema is not empty"). Baseline: mark the initial
# migration as already applied so only real deltas (archived_at, etc.) run. Without this
# fallback, those installs keep failing deploy until someone runs migrate resolve manually.
echo "Applying Prisma migrations..."
if ! pnpm --filter @ha-addon/server db:migrate:deploy; then
  echo "Prisma migrate deploy failed — attempting baseline for existing database..."
  pnpm --filter @ha-addon/server exec prisma migrate resolve --applied 20260325204348_init_baseline || true
  pnpm --filter @ha-addon/server db:migrate:deploy || echo "Schema migration failed — continuing without database"
fi

echo "Starting application on port $PORT..."
exec pnpm start

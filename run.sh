#!/usr/bin/with-contenv bashio

set -e

DATABASE_URL=$(bashio::config 'database_url')
LOG_LEVEL=$(bashio::config 'log_level')

INGRESS_PORT=$(bashio::addon.ingress_port)
ADDON_VERSION=$(bashio::addon.version)
ADDON_HOSTNAME=$(bashio::addon.hostname)
ADDON_INGRESS_URL=$(bashio::addon.ingress_url)

export ADDON_HOSTNAME
export ADDON_INGRESS_URL

bashio::log.info "Starting HA Filament SpoolTracker v${ADDON_VERSION}..."

export NODE_ENV=production
export HOME_ASSISTANT=true
export PORT="$INGRESS_PORT"
export LOG_LEVEL="$LOG_LEVEL"
export ADDON_VERSION="$ADDON_VERSION"
export APP_ROOT="/app"
export SERVER_PATH="/app/server"
export CLIENT_PATH="/app/client"

cd "$APP_ROOT"

run_prisma() {
  local cli
  cli="$(cd "$SERVER_PATH" && node -p "require('path').join(require('path').dirname(require.resolve('prisma/package.json')), 'build', 'index.js')")"
  (cd "$SERVER_PATH" && node "$cli" "$@")
}

# Database is optional — only configure if URL is provided
if [ -n "$DATABASE_URL" ]; then
  export DATABASE_URL="$DATABASE_URL"
  bashio::log.info "Database configured at ${DATABASE_URL}"
else
  export DATABASE_URL="file:/data/app.db"
  bashio::log.info "No database URL configured — using local SQLite at /data/app.db"
fi

# migrate deploy runs ordered SQL migrations (backfill archived_at, then drop is_archived).
# db push is unsafe here: it would drop is_archived without backfill and abort on data-loss warnings.
bashio::log.info "Applying database migrations..."
if ! run_prisma migrate deploy; then
  bashio::log.warning "Migrate deploy failed — attempting baseline for existing database..."
  run_prisma migrate resolve --applied 20260325204348_init_baseline || true
  run_prisma migrate deploy || bashio::log.warning "Migrations failed — continuing (app may error until the database is fixed)"
fi

bashio::log.info "Starting application on port $PORT..."
exec node "$SERVER_PATH/dist/server/index.js"

#!/usr/bin/env bash
# Run Prisma migrations and optionally seed the database.
# Usage: ./scripts/migrate.sh [--seed]

set -e

cd "$(dirname "$0")/.."

echo "Running Prisma migrations..."
pnpm --filter @ha-addon/server db:migrate:deploy

if [ "$1" = "--seed" ]; then
  echo "Seeding database..."
  pnpm --filter @ha-addon/server db:seed
fi

echo "Done."

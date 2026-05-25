#!/usr/bin/env bash
# Start local Postgres + push schema. Requires Docker Desktop running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Open Docker Desktop and try again."
  exit 1
fi

echo "Starting local Postgres (pgvector)..."
docker compose -f docker-compose.postgres.yml up -d

echo "Waiting for database..."
for i in $(seq 1 30); do
  if docker exec aurafit-pg pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Enabling pgvector extension..."
docker exec aurafit-pg psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null

echo "Pushing Prisma schema..."
npm run db:push

echo ""
echo "Local database ready at 127.0.0.1:54322"

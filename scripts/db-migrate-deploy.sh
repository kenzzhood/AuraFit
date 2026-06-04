#!/usr/bin/env bash
# Apply pending Prisma migrations (post-deploy). Requires DATABASE_URL or azd env + web secret.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "▸ prisma migrate deploy (DATABASE_URL from env)"
  npx prisma migrate deploy
  exit 0
fi

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ Set DATABASE_URL or install azd to resolve credentials." >&2
  exit 1
fi

eval "$(azd env get-values 2>/dev/null | sed 's/^/export /')"

RG="${AZURE_RESOURCE_GROUP:?}"
WEB="${AZURE_WEB_APP_NAME:?}"

if ! command -v az >/dev/null 2>&1; then
  echo "✗ Azure CLI required when DATABASE_URL is unset." >&2
  exit 1
fi

DATABASE_URL=$(az containerapp secret show -g "$RG" -n "$WEB" --secret-name database-url --query value -o tsv)
if [[ -z "$DATABASE_URL" ]]; then
  echo "✗ Could not read database-url from $WEB" >&2
  exit 1
fi

echo "▸ prisma migrate deploy"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

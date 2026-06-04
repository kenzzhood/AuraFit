#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-shot post-deploy DB initialization.
#   1. Pull the deployed DATABASE_URL from the web Container App secret
#   2. Add this machine's public IP to the Postgres firewall (temporary)
#   3. CREATE EXTENSION vector / uuid-ossp / pgcrypto (idempotent)
#   4. prisma migrate deploy
#   5. Remove the temporary firewall rule
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ azd not found." >&2
  exit 1
fi
if ! command -v az >/dev/null 2>&1; then
  echo "✗ Azure CLI not found." >&2
  exit 1
fi

eval "$(azd env get-values 2>/dev/null | sed 's/^/export /')"

RG="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP not set}"
PG="${AZURE_POSTGRES_SERVER_NAME:?AZURE_POSTGRES_SERVER_NAME not set}"
PG_FQDN="${AZURE_POSTGRES_FQDN:?AZURE_POSTGRES_FQDN not set}"
WEB="${AZURE_WEB_APP_NAME:?AZURE_WEB_APP_NAME not set}"

DATABASE_URL=$(az containerapp secret show -g "$RG" -n "$WEB" --secret-name database-url --query value -o tsv)

if [[ -z "$DATABASE_URL" ]]; then
  echo "✗ Could not read database-url secret from $WEB" >&2
  exit 1
fi

MY_IP=$(curl -fsS https://api.ipify.org)
RULE_NAME="dbinit-$(date +%s)"

cleanup() {
  echo "  ↳ removing temporary firewall rule $RULE_NAME"
  az postgres flexible-server firewall-rule delete \
    -g "$RG" -n "$PG" --rule-name "$RULE_NAME" --yes -o none 2>/dev/null || true
}
trap cleanup EXIT

echo "▸ Initializing Aurafit Postgres ($PG_FQDN)"
echo "  ↳ allowing this machine ($MY_IP) temporarily..."
az postgres flexible-server firewall-rule create \
  -g "$RG" -n "$PG" --rule-name "$RULE_NAME" \
  --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none

echo "  ↳ enabling extensions (vector, uuid-ossp, pgcrypto)..."
DATABASE_URL="$DATABASE_URL" node scripts/db-create-extensions.mjs

echo "  ↳ running prisma migrate deploy..."
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo ""
echo "✓ Database ready. Run 'npm run azure:status' to confirm everything is up."

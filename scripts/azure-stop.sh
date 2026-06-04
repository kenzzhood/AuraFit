#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pause Aurafit — near-zero compute cost.
#
#   - Stops Postgres (storage-only billing ~₹250/mo)
#   - Sets web + crawler to min=max=0 (no Container Apps compute)
#
# Fixed idle floor (~₹650/mo): ACR Basic + Postgres storage + Log Analytics.
# To remove everything:  azd down --purge
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ azd not found. Install: https://aka.ms/azd" >&2
  exit 1
fi
if ! command -v az >/dev/null 2>&1; then
  echo "✗ Azure CLI not found. Install: https://aka.ms/azcli" >&2
  exit 1
fi

eval "$(azd env get-values 2>/dev/null | sed 's/^/export /')"

RG="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP not set — has azd up been run?}"
PG="${AZURE_POSTGRES_SERVER_NAME:?AZURE_POSTGRES_SERVER_NAME not set}"
WEB="${AZURE_WEB_APP_NAME:?AZURE_WEB_APP_NAME not set}"
CRAWLER="${AZURE_CRAWLER_APP_NAME:?AZURE_CRAWLER_APP_NAME not set}"

echo "▸ Pausing Aurafit in $RG (idle mode)"
echo ""

echo "  ↳ stopping Postgres ($PG)..."
PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv 2>/dev/null || echo "Unknown")
if [[ "$PG_STATE" == "Ready" ]]; then
  az postgres flexible-server stop -g "$RG" -n "$PG" -o none
  echo "    ✓ Postgres stopping (storage-only ~₹250/mo)"
else
  echo "    ↳ Postgres already in state: $PG_STATE"
fi

echo "  ↳ scaling web to zero ($WEB)..."
az containerapp update -g "$RG" -n "$WEB" \
  --min-replicas 0 --max-replicas 3 \
  --query 'name' -o tsv >/dev/null
echo "    ✓ web min=0 (scales to zero on idle)"

echo "  ↳ scaling crawler to zero ($CRAWLER)..."
az containerapp update -g "$RG" -n "$CRAWLER" \
  --min-replicas 0 --max-replicas 2 \
  --query 'name' -o tsv >/dev/null
echo "    ✓ crawler min=0 (scales to zero on idle)"

echo ""
echo "✓ Aurafit paused."
echo "  Idle burn: ~₹650/mo (ACR + Postgres storage + logs) — no compute."
echo "  Resume:    npm run azure:start"

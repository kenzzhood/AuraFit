#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Resume Aurafit for an active session (demo, testing, mobile use).
#
#   - Starts Postgres (required for API / generation)
#   - Sets web + crawler to min=1 so generation doesn't hit cold-start timeouts
#   - Does NOT start Inngest (QUEUE_PROVIDERS=inline); run azure:stop to scale it to zero
#   - Warms web → DB → crawler before you open the app
#
# For scale-to-zero between requests (Postgres still running, ~₹210/day DB):
#   npm run azure:start -- --scale-to-zero
#
# When done testing, always run:  npm run azure:stop
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

SCALE_TO_ZERO=false
for arg in "$@"; do
  case "$arg" in
    --scale-to-zero) SCALE_TO_ZERO=true ;;
  esac
done

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

WEB_MIN=1
CR_MIN=1
if [[ "$SCALE_TO_ZERO" == "true" ]]; then
  WEB_MIN=0
  CR_MIN=0
fi

echo "▸ Starting Aurafit in $RG"
echo ""

echo "  ↳ starting Postgres ($PG)..."
PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv 2>/dev/null || echo "Unknown")
if [[ "$PG_STATE" != "Ready" ]]; then
  az postgres flexible-server start -g "$RG" -n "$PG" -o none
  echo "    ↳ waiting for Postgres to become Ready..."
  for _ in $(seq 1 36); do
    PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv 2>/dev/null || echo "Unknown")
    [[ "$PG_STATE" == "Ready" ]] && break
    sleep 5
  done
  if [[ "$PG_STATE" != "Ready" ]]; then
    echo "    ✗ Postgres did not reach Ready in time (state: $PG_STATE)" >&2
    exit 1
  fi
  echo "    ✓ Postgres started"
else
  echo "    ↳ Postgres already running"
fi

echo "  ↳ scaling web ($WEB) min=$WEB_MIN max=3..."
az containerapp update -g "$RG" -n "$WEB" \
  --min-replicas "$WEB_MIN" --max-replicas 3 \
  --query 'name' -o tsv >/dev/null
echo "    ✓ web updated"

echo "  ↳ scaling crawler ($CRAWLER) min=$CR_MIN max=2..."
az containerapp update -g "$RG" -n "$CRAWLER" \
  --min-replicas "$CR_MIN" --max-replicas 2 \
  --query 'name' -o tsv >/dev/null
echo "    ✓ crawler updated"

WEB_FQDN=$(az containerapp show -g "$RG" -n "$WEB" --query 'properties.configuration.ingress.fqdn' -o tsv)
WEB_URL="https://${WEB_FQDN}"

if [[ "$WEB_MIN" -ge 1 ]]; then
  echo ""
  echo "  ↳ warming web + database + crawler (may take 30–90s on cold start)..."
  for attempt in $(seq 1 18); do
    if curl -fsS --max-time 25 "${WEB_URL}/api/health?warm=1" >/dev/null 2>&1; then
      echo "    ✓ stack warm"
      break
    fi
    if [[ "$attempt" -eq 18 ]]; then
      echo "    ⚠ warmup timed out — first app request may still be slow"
    else
      sleep 5
    fi
  done
fi

echo ""
echo "✓ Aurafit is up."
echo "  Web URL:  $WEB_URL"
if [[ "$SCALE_TO_ZERO" == "true" ]]; then
  echo "  Mode:     scale-to-zero (first request ~10–30s cold start)"
else
  echo "  Mode:     warm (min=1 web + crawler — best for generation)"
fi
echo ""
echo "  When finished:  npm run azure:stop   ← stops Postgres + all compute (~₹650/mo idle)"

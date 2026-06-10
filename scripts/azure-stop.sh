#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pause Aurafit — near-zero compute cost.
#
#   - Stops Postgres (storage-only billing ~₹250/mo)
#   - Scales ALL Container Apps to min=0 (web, crawler, inngest, any others)
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
INNGEST="${AZURE_INNGEST_APP_NAME:-aurafit-inngest}"

scale_app_to_zero() {
  local app="$1"
  local max_replicas="${2:-1}"
  if ! az containerapp show -g "$RG" -n "$app" >/dev/null 2>&1; then
    echo "    ↳ $app not found — skipped"
    return 0
  fi
  az containerapp update -g "$RG" -n "$app" \
    --min-replicas 0 --max-replicas "$max_replicas" \
    --query 'name' -o tsv >/dev/null
  echo "    ✓ $app min=0"
}

remove_inngest_if_present() {
  if ! az containerapp show -g "$RG" -n "$INNGEST" >/dev/null 2>&1; then
    echo "    ↳ $INNGEST not present — skipped"
    return 0
  fi
  # Inngest was deployed with minReplicas=1 and keeps a warm replica even at
  # min=0. We use QUEUE_PROVIDERS=inline, so delete it on pause to stop compute.
  echo "  ↳ removing Inngest ($INNGEST) — inline queue does not need it..."
  az containerapp delete -g "$RG" -n "$INNGEST" --yes -o none
  echo "    ✓ deleted (recreate with \`azd deploy\` if you switch back to Inngest)"
}

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

echo "  ↳ scaling Container Apps to zero..."
scale_app_to_zero "$WEB" 3
scale_app_to_zero "$CRAWLER" 2
remove_inngest_if_present

# Catch any other container apps in the RG (future-proof).
while IFS= read -r app; do
  [[ -z "$app" ]] && continue
  case "$app" in
    "$WEB"|"$CRAWLER"|"$INNGEST") continue ;;
  esac
  max=$(az containerapp show -g "$RG" -n "$app" --query 'properties.template.scale.maxReplicas' -o tsv 2>/dev/null || echo "1")
  scale_app_to_zero "$app" "$max"
done < <(az containerapp list -g "$RG" --query "[].name" -o tsv 2>/dev/null || true)

echo "  ↳ waiting for replicas to drain..."
for _ in $(seq 1 12); do
  total=0
  while IFS= read -r app; do
    [[ -z "$app" ]] && continue
    n=$(az containerapp replica list -g "$RG" -n "$app" --query 'length(@)' -o tsv 2>/dev/null || echo "0")
    total=$((total + n))
  done < <(az containerapp list -g "$RG" --query "[].name" -o tsv 2>/dev/null || true)
  [[ "$total" -eq 0 ]] && break
  sleep 5
done
if [[ "${total:-0}" -gt 0 ]]; then
  echo "    ⚠ $total replica(s) still draining — compute should drop to zero within a few minutes"
else
  echo "    ✓ all replicas stopped"
fi

echo ""
echo "✓ Aurafit paused."
echo "  Idle burn: ~₹650/mo (ACR + Postgres storage + logs) — no compute."
echo "  Resume:    npm run azure:start"

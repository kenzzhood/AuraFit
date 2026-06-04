#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Report Aurafit Azure state and rough INR burn rate.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ azd not found. Install: https://aka.ms/azd" >&2
  exit 1
fi

eval "$(azd env get-values 2>/dev/null | sed 's/^/export /')"

RG="${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP not set — has azd up been run?}"
PG="${AZURE_POSTGRES_SERVER_NAME:?AZURE_POSTGRES_SERVER_NAME not set}"
WEB="${AZURE_WEB_APP_NAME:?AZURE_WEB_APP_NAME not set}"
CRAWLER="${AZURE_CRAWLER_APP_NAME:?AZURE_CRAWLER_APP_NAME not set}"

echo "Aurafit Azure status"
echo "  Resource group: $RG"
echo ""

PG_STATE=$(az postgres flexible-server show -g "$RG" -n "$PG" --query state -o tsv 2>/dev/null || echo "Unknown")
echo "  Postgres ($PG):"
echo "    state: $PG_STATE"

WEB_MIN=$(az containerapp show -g "$RG" -n "$WEB" --query 'properties.template.scale.minReplicas' -o tsv 2>/dev/null || echo "?")
WEB_MAX=$(az containerapp show -g "$RG" -n "$WEB" --query 'properties.template.scale.maxReplicas' -o tsv 2>/dev/null || echo "?")
WEB_REPLICAS=$(az containerapp replica list -g "$RG" -n "$WEB" --query 'length(@)' -o tsv 2>/dev/null || echo "?")
WEB_FQDN=$(az containerapp show -g "$RG" -n "$WEB" --query 'properties.configuration.ingress.fqdn' -o tsv 2>/dev/null || echo "?")
echo ""
echo "  Web ($WEB):"
echo "    scale:    min=$WEB_MIN, max=$WEB_MAX"
echo "    running:  $WEB_REPLICAS replicas"
echo "    url:      https://$WEB_FQDN"

CR_MIN=$(az containerapp show -g "$RG" -n "$CRAWLER" --query 'properties.template.scale.minReplicas' -o tsv 2>/dev/null || echo "?")
CR_MAX=$(az containerapp show -g "$RG" -n "$CRAWLER" --query 'properties.template.scale.maxReplicas' -o tsv 2>/dev/null || echo "?")
CR_REPLICAS=$(az containerapp replica list -g "$RG" -n "$CRAWLER" --query 'length(@)' -o tsv 2>/dev/null || echo "?")
echo ""
echo "  Crawler ($CRAWLER):"
echo "    scale:    min=$CR_MIN, max=$CR_MAX"
echo "    running:  $CR_REPLICAS replicas"

echo ""
if [[ "$PG_STATE" == "Stopped" || "$PG_STATE" == "Stopping" ]] && [[ "$WEB_MIN" == "0" ]]; then
  echo "  → PAUSED (idle). ~₹650/mo fixed (ACR + PG storage + logs)."
  echo "    Run: npm run azure:start"
elif [[ "$PG_STATE" == "Ready" ]] && [[ "$WEB_MIN" -ge 1 ]]; then
  echo "  → ACTIVE (warm). ~₹400–500/day while this stays up."
  echo "    Run: npm run azure:stop  when finished"
elif [[ "$PG_STATE" == "Ready" ]] && [[ "$WEB_MIN" == "0" ]]; then
  echo "  → Postgres ON + scale-to-zero apps. ~₹210/day DB + per-use compute."
  echo "    Tip: npm run azure:stop when done, or azure:start (no flags) to warm for generation"
else
  echo "  → Mixed state — run npm run azure:start or npm run azure:stop to normalize"
fi

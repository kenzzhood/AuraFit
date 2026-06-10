#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deep probe: subscription offer + provider state + REAL deployment validation
# across multiple regions. Uses `az deployment group validate` because that's
# what actually triggers the Postgres-Flex offer-restriction check (unlike
# `list-skus`, which is metadata-only).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

LOG_FILE="$PWD/.cursor/debug-a5c909.log"
RG_NAME="aurafit-rg"
SESSION_ID="a5c909"
RUN_ID="probe2-$(date +%s)"

mkdir -p "$(dirname "$LOG_FILE")"

# #region agent log
log_event() {
  local hypothesis="$1" location="$2" message="$3" data="$4"
  local ts
  ts=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")
  printf '{"sessionId":"%s","runId":"%s","hypothesisId":"%s","location":"%s","message":"%s","data":%s,"timestamp":%s}\n' \
    "$SESSION_ID" "$RUN_ID" "$hypothesis" "$location" "$message" "$data" "$ts" >> "$LOG_FILE"
}
# #endregion

echo "▸ Aurafit deep Postgres probe — session $SESSION_ID, run $RUN_ID"
echo "  Writing evidence to $LOG_FILE"
echo ""

# H11: subscription offer type
echo "▸ H11 — subscription offer details"
QUOTA_ID=$(az account show --query "subscriptionPolicies.quotaId" -o tsv 2>/dev/null || echo "?")
SPEND_LIMIT=$(az account show --query "subscriptionPolicies.spendingLimit" -o tsv 2>/dev/null || echo "?")
LOC_PLACEMENT=$(az account show --query "subscriptionPolicies.locationPlacementId" -o tsv 2>/dev/null || echo "?")
SUB_STATE=$(az account show --query "state" -o tsv 2>/dev/null || echo "?")
log_event "H11" "probe2:sub" "subscription_policies" \
  "{\"quotaId\":\"$QUOTA_ID\",\"spendingLimit\":\"$SPEND_LIMIT\",\"locationPlacementId\":\"$LOC_PLACEMENT\",\"state\":\"$SUB_STATE\"}"
echo "  quotaId:             $QUOTA_ID"
echo "  spendingLimit:       $SPEND_LIMIT"
echo "  locationPlacementId: $LOC_PLACEMENT"
echo "  state:               $SUB_STATE"
echo ""

# H12: Microsoft.DBforPostgreSQL provider state
echo "▸ H12 — Microsoft.DBforPostgreSQL provider registration"
PROVIDER_STATE=$(az provider show --namespace Microsoft.DBforPostgreSQL --query "registrationState" -o tsv 2>&1 || echo "?")
log_event "H12" "probe2:provider" "provider_state" "{\"state\":\"$PROVIDER_STATE\"}"
echo "  state: $PROVIDER_STATE"
echo ""

# H7: validate-only Postgres deployment in candidate regions
echo "▸ H7 — validate-only deployment per region (real offer check)"

TEMPLATE_FILE=$(mktemp -t pg-probe-XXXXXX.json)
cat > "$TEMPLATE_FILE" <<'JSON'
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "type": "string" },
    "serverName": { "type": "string" }
  },
  "resources": [
    {
      "type": "Microsoft.DBforPostgreSQL/flexibleServers",
      "apiVersion": "2024-08-01",
      "name": "[parameters('serverName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "Standard_B1ms", "tier": "Burstable" },
      "properties": {
        "version": "16",
        "administratorLogin": "probeadmin",
        "administratorLoginPassword": "ProbeP@ssw0rd9999!",
        "storage": { "storageSizeGB": 32 },
        "network": { "publicNetworkAccess": "Enabled" }
      }
    }
  ]
}
JSON

CANDIDATES=(eastus westus2 westus3 southindia centralindia japaneast westeurope australiaeast)
ALLOWED=()

for region in "${CANDIDATES[@]}"; do
  printf "  validating %-15s ... " "$region"
  SNAME="probepg$(date +%s)$$$RANDOM"
  RESULT=$(az deployment group validate \
    --resource-group "$RG_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "location=$region" "serverName=$SNAME" \
    --output json 2>&1 || true)

  if echo "$RESULT" | grep -qi "LocationIsOfferRestricted"; then
    log_event "H7" "probe2:val:$region" "validate_restricted" "{\"region\":\"$region\"}"
    echo "RESTRICTED"
  elif echo "$RESULT" | grep -qE "\"provisioningState\":\\s*\"Succeeded\"|\"validationLevel\""; then
    log_event "H7" "probe2:val:$region" "validate_passed" "{\"region\":\"$region\"}"
    echo "PASSED ✓"
    ALLOWED+=("$region")
  else
    SNIP=$(echo "$RESULT" | head -c 220 | tr -d '\n' | sed 's/"/\\"/g; s/\\/\\\\/g')
    log_event "H7" "probe2:val:$region" "validate_other" \
      "{\"region\":\"$region\",\"snippet\":\"$SNIP\"}"
    echo "OTHER"
  fi
done

rm -f "$TEMPLATE_FILE"

echo ""
if [[ ${#ALLOWED[@]} -gt 0 ]]; then
  echo "✓ Postgres Flex provisioning IS allowed in: ${ALLOWED[*]}"
  log_event "summary" "probe2:summary" "summary" \
    "{\"allowedCount\":${#ALLOWED[@]},\"allowed\":[$(printf '\"%s\",' "${ALLOWED[@]}" | sed 's/,$//')]}"
else
  echo "✗ Postgres Flex is restricted in ALL probed regions for this subscription."
  log_event "summary" "probe2:summary" "summary" "{\"allowedCount\":0}"
fi

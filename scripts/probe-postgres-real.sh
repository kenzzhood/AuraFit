#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

LOG_FILE="$PWD/.cursor/debug-a5c909.log"
SESSION_ID="a5c909"
RUN_ID="real-probe-$(date +%s)"
RG="${AZURE_RESOURCE_GROUP:-aurafit-rg}"
TMP_DIR="$(mktemp -d -t aurafit-pg-probe.XXXXXX)"
DEPLOY_TEMPLATE="$TMP_DIR/probe.bicep"
PASSWORD="Probe$(date +%s)Aa1!"

# #region agent log
log_event() {
  local hypothesis="$1" location="$2" message="$3" data="$4"
  local ts
  ts=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")
  printf '{"sessionId":"%s","runId":"%s","hypothesisId":"%s","location":"%s","message":"%s","data":%s,"timestamp":%s}\n' \
    "$SESSION_ID" "$RUN_ID" "$hypothesis" "$location" "$message" "$data" "$ts" >> "$LOG_FILE"
}

json_string() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[:900]))'
}
# #endregion

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$DEPLOY_TEMPLATE" <<'BICEP'
targetScope = 'resourceGroup'

param serverName string
param location string
@secure()
param administratorLoginPassword string

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'aurafit_probe'
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
  }
}
BICEP

echo "Real Postgres Flex provisioning probe"
echo "Resource group: $RG"
echo "This creates a tiny temporary server, then deletes it on the first success."
echo ""

CANDIDATES=(centralindia westus2 westus3 westeurope japaneast australiaeast eastus southindia)
SUCCESS_REGION=""

for REGION in "${CANDIDATES[@]}"; do
  SERVER_NAME="aurafitpgprobe$(date +%s)${REGION//-/}"
  SERVER_NAME="${SERVER_NAME:0:63}"
  DEPLOYMENT_NAME="aurafit-pg-real-probe-${REGION}-$(date +%s)"

  echo "Testing $REGION ..."
  set +e
  OUTPUT=$(
    az deployment group create \
      --resource-group "$RG" \
      --name "$DEPLOYMENT_NAME" \
      --template-file "$DEPLOY_TEMPLATE" \
      --parameters serverName="$SERVER_NAME" location="$REGION" administratorLoginPassword="$PASSWORD" \
      --only-show-errors \
      -o none 2>&1
  )
  EC=$?
  set -e

  CLASS="other"
  if [[ $EC -eq 0 ]]; then
    CLASS="created"
  elif [[ "$OUTPUT" == *"LocationIsOfferRestricted"* ]]; then
    CLASS="offer_restricted"
  elif [[ "$OUTPUT" == *"Sku"* || "$OUTPUT" == *"SKU"* || "$OUTPUT" == *"skus"* ]]; then
    CLASS="sku_or_capacity"
  elif [[ "$OUTPUT" == *"name already exists"* || "$OUTPUT" == *"conflicting state"* ]]; then
    CLASS="name_conflict"
  elif [[ "$OUTPUT" == *"InvalidTemplate"* || "$OUTPUT" == *"InvalidRequestContent"* || "$OUTPUT" == *"The template"* ]]; then
    CLASS="template_or_bicep"
  elif [[ "$OUTPUT" == *"AuthorizationFailed"* || "$OUTPUT" == *"does not have authorization"* ]]; then
    CLASS="authorization"
  elif [[ "$OUTPUT" == *"already exists"* || "$OUTPUT" == *"soft-deleted"* ]]; then
    CLASS="name_or_soft_delete"
  fi

  OUTPUT_EXCERPT=$(printf '%s' "$OUTPUT" | json_string)
  log_event "H13-H16" "real-probe:$REGION" "region_result" "{\"region\":\"$REGION\",\"class\":\"$CLASS\",\"exitCode\":$EC,\"serverName\":\"$SERVER_NAME\",\"outputExcerpt\":$OUTPUT_EXCERPT}"

  if [[ $EC -eq 0 ]]; then
    echo "  PASSED: created $SERVER_NAME in $REGION"
    echo "  Deleting temporary server ..."
    set +e
    az postgres flexible-server delete --resource-group "$RG" --name "$SERVER_NAME" --yes --only-show-errors -o none
    DELETE_EC=$?
    set -e
    log_event "cleanup" "real-probe:$REGION" "delete_temp_server" "{\"region\":\"$REGION\",\"exitCode\":$DELETE_EC,\"serverName\":\"$SERVER_NAME\"}"
    SUCCESS_REGION="$REGION"
    break
  fi

  echo "  FAILED: $CLASS"
  if [[ -n "$OUTPUT" ]]; then
    printf '%s\n' "$OUTPUT" | sed 's/^/    /' | head -n 8
  fi
done

if [[ -n "$SUCCESS_REGION" ]]; then
  log_event "summary" "real-probe:summary" "success_region" "{\"region\":\"$SUCCESS_REGION\"}"
  echo ""
  echo "Success: use POSTGRES_LOCATION=$SUCCESS_REGION"
  exit 0
fi

log_event "summary" "real-probe:summary" "no_success_region" "{}"
echo ""
echo "No tested region could create Postgres Flex with Standard_B1ms/Postgres 16."
exit 1

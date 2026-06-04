#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Wait for Microsoft.DBforPostgreSQL provider registration to complete, then
# re-trigger the azd deploy. Use this once after the deep probe confirms the
# provider is in 'Registering' state.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

LOG_FILE="/Users/gouthamsrinath/Websites/Aurafit/.cursor/debug-a5c909.log"
SESSION_ID="a5c909"
RUN_ID="postfix-$(date +%s)"
NS="Microsoft.DBforPostgreSQL"

# #region agent log
log_event() {
  local hypothesis="$1" location="$2" message="$3" data="$4"
  local ts
  ts=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")
  printf '{"sessionId":"%s","runId":"%s","hypothesisId":"%s","location":"%s","message":"%s","data":%s,"timestamp":%s}\n' \
    "$SESSION_ID" "$RUN_ID" "$hypothesis" "$location" "$message" "$data" "$ts" >> "$LOG_FILE"
}
# #endregion

echo "▸ Step 1/3 — wait for $NS provider to finish registering"
echo "  (this can take 5-15 minutes; az register --wait blocks until done)"
echo ""

START_STATE=$(az provider show --namespace "$NS" --query registrationState -o tsv 2>/dev/null || echo "?")
log_event "H12" "finish:start" "start_state" "{\"state\":\"$START_STATE\"}"
echo "  current state: $START_STATE"

# This is idempotent — if already Registered, it returns immediately.
az provider register --namespace "$NS" --wait

END_STATE=$(az provider show --namespace "$NS" --query registrationState -o tsv 2>/dev/null || echo "?")
log_event "H12" "finish:done" "end_state" "{\"state\":\"$END_STATE\"}"
echo "  end state: $END_STATE"

if [[ "$END_STATE" != "Registered" ]]; then
  echo "✗ Provider did not reach Registered state ($END_STATE). Cannot continue." >&2
  exit 1
fi
echo "  ✓ Registered"
echo ""

echo "▸ Step 2/3 — pin POSTGRES_LOCATION to verified region"
azd env set POSTGRES_LOCATION centralindia
log_event "config" "finish:env" "postgres_location_set" "{\"value\":\"centralindia\",\"evidence\":\"probe-postgres-real created and deleted Standard_B1ms/Postgres16 successfully\"}"
echo "  ✓ POSTGRES_LOCATION=centralindia"
echo ""

echo "▸ Step 3/3 — running azd up to provision Postgres + deploy web container"
log_event "deploy" "finish:azd-up" "azd_up_start" "{}"
azd up
DEPLOY_EC=$?
log_event "deploy" "finish:azd-up" "azd_up_exit" "{\"code\":$DEPLOY_EC}"

if [[ $DEPLOY_EC -eq 0 ]]; then
  echo ""
  echo "✓ Deployment finished. Run: npm run azure:db-init"
fi

exit $DEPLOY_EC

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-shot azd environment setup for Aurafit.
#
# Reads .env.local at the repo root and pushes all the values that Bicep
# needs (Clerk keys, Azure OpenAI keys, Storage keys, etc.) into the azd
# environment. After running this, `azd up` has everything it needs.
#
# Usage:
#   bash scripts/azure-env-setup.sh [env-name]
#       env-name defaults to "aurafit-prod"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_NAME="${1:-aurafit-prod}"
LOCATION="eastus2"
ENV_FILE=".env.local"

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ azd not found. Install with: brew install azd" >&2
  exit 1
fi
if ! command -v az >/dev/null 2>&1; then
  echo "✗ Azure CLI not found. Install with: brew install azure-cli" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE not found at $(pwd). Cannot read keys." >&2
  exit 1
fi

# Source .env.local without exporting unrelated symbols
get_var() {
  local key="$1"
  awk -F= -v k="$key" '
    /^[[:space:]]*#/ { next }
    NF >= 2 && $1 == k {
      sub(/^[[:space:]]+/, "", $2)
      sub(/[[:space:]]+$/, "", $2)
      gsub(/^"|"$/, "", $2)
      print $2
      exit
    }
  ' "$ENV_FILE"
}

require() {
  local val="$1" name="$2"
  if [[ -z "$val" ]]; then
    echo "✗ $name is empty in $ENV_FILE" >&2
    exit 1
  fi
}

echo "▸ Reading values from $ENV_FILE"
CLERK_PK=$(get_var NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
CLERK_SK=$(get_var CLERK_SECRET_KEY)
OAI_ENDPOINT=$(get_var AZURE_OPENAI_ENDPOINT)
OAI_KEY=$(get_var AZURE_OPENAI_API_KEY)
OAI_IMG_ENDPOINT=$(get_var AZURE_OPENAI_IMAGE_ENDPOINT)
OAI_IMG_KEY=$(get_var AZURE_OPENAI_IMAGE_API_KEY)
ST_NAME=$(get_var AZURE_STORAGE_ACCOUNT_NAME)
ST_KEY=$(get_var AZURE_STORAGE_ACCOUNT_KEY)
ST_CONN=$(get_var AZURE_STORAGE_CONNECTION_STRING)

require "$CLERK_PK" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
require "$CLERK_SK" "CLERK_SECRET_KEY"
require "$OAI_ENDPOINT" "AZURE_OPENAI_ENDPOINT"
require "$OAI_KEY" "AZURE_OPENAI_API_KEY"
require "$OAI_IMG_ENDPOINT" "AZURE_OPENAI_IMAGE_ENDPOINT"
require "$OAI_IMG_KEY" "AZURE_OPENAI_IMAGE_API_KEY"
require "$ST_NAME" "AZURE_STORAGE_ACCOUNT_NAME"
require "$ST_KEY" "AZURE_STORAGE_ACCOUNT_KEY"
require "$ST_CONN" "AZURE_STORAGE_CONNECTION_STRING"

# Random crawler key (32-byte hex). Reused on every run if the env already
# has one set — avoids changing it every time.
EXISTING_CRAWLER_KEY=""
if azd env list --output json 2>/dev/null | grep -q "\"$ENV_NAME\""; then
  EXISTING_CRAWLER_KEY=$(azd env get-value CRAWLER_API_KEY 2>/dev/null || echo "")
fi
if [[ -n "$EXISTING_CRAWLER_KEY" ]]; then
  CRAWLER_KEY="$EXISTING_CRAWLER_KEY"
else
  CRAWLER_KEY=$(openssl rand -hex 32)
fi

EXISTING_INNGEST_EVENT_KEY=""
EXISTING_INNGEST_SIGNING_KEY=""
if azd env list --output json 2>/dev/null | grep -q "\"$ENV_NAME\""; then
  EXISTING_INNGEST_EVENT_KEY=$(azd env get-value INNGEST_EVENT_KEY 2>/dev/null || echo "")
  EXISTING_INNGEST_SIGNING_KEY=$(azd env get-value INNGEST_SIGNING_KEY 2>/dev/null || echo "")
fi
if [[ -n "$EXISTING_INNGEST_EVENT_KEY" && -n "$EXISTING_INNGEST_SIGNING_KEY" ]]; then
  INNGEST_EVENT_KEY="$EXISTING_INNGEST_EVENT_KEY"
  INNGEST_SIGNING_KEY="$EXISTING_INNGEST_SIGNING_KEY"
else
  INNGEST_EVENT_KEY=$(openssl rand -hex 16)
  INNGEST_SIGNING_KEY=$(openssl rand -hex 32)
fi

echo "▸ Selecting/creating azd env: $ENV_NAME"
if azd env list --output json 2>/dev/null | grep -q "\"$ENV_NAME\""; then
  azd env select "$ENV_NAME" >/dev/null
  echo "    ↳ existing env selected"
else
  azd env new "$ENV_NAME" --location "$LOCATION" >/dev/null
  echo "    ↳ created"
fi

echo "▸ Pushing values into azd env"
azd env set AZURE_LOCATION "$LOCATION"
# Postgres goes to centralindia by default because this subscription proved it
# can create Standard_B1ms/Postgres 16 there during the real provisioning probe.
# Override with: azd env set POSTGRES_LOCATION <region>
azd env set POSTGRES_LOCATION "${POSTGRES_LOCATION:-centralindia}"
azd env set CLERK_PUBLISHABLE_KEY "$CLERK_PK"
azd env set CLERK_SECRET_KEY "$CLERK_SK"
azd env set AZURE_OPENAI_ENDPOINT "$OAI_ENDPOINT"
azd env set AZURE_OPENAI_API_KEY "$OAI_KEY"
azd env set AZURE_OPENAI_IMAGE_ENDPOINT "$OAI_IMG_ENDPOINT"
azd env set AZURE_OPENAI_IMAGE_API_KEY "$OAI_IMG_KEY"
azd env set AZURE_STORAGE_ACCOUNT_NAME "$ST_NAME"
azd env set AZURE_STORAGE_ACCOUNT_KEY "$ST_KEY"
azd env set AZURE_STORAGE_CONNECTION_STRING "$ST_CONN"
azd env set CRAWLER_API_KEY "$CRAWLER_KEY"
azd env set INNGEST_EVENT_KEY "$INNGEST_EVENT_KEY"
azd env set INNGEST_SIGNING_KEY "$INNGEST_SIGNING_KEY"

echo ""
echo "✓ Environment '$ENV_NAME' ready (location: $LOCATION)."
echo ""
echo "Next steps:"
echo "  1. az login           # if you haven't already"
echo "  2. azd auth login     # if you haven't already"
echo "  3. npm run azure:up   # provisions + builds + deploys (~10 min)"
echo "  4. npm run azure:db-init"

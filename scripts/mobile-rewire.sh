#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Point the mobile preview build at the deployed Azure backend, then
# trigger a fresh APK build via EAS.
#
# Run from repo root:  bash scripts/mobile-rewire.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v azd >/dev/null 2>&1; then
  echo "✗ azd not found. Install with: brew install azd" >&2
  exit 1
fi

WEB_URL=$(azd env get-values 2>/dev/null \
  | awk -F= '/^AZURE_WEB_APP_URL=/{gsub(/"/, "", $2); print $2}')

if [[ -z "$WEB_URL" ]]; then
  echo "✗ AZURE_WEB_APP_URL is empty in azd env." >&2
  echo "   Run 'npm run azure:up' first or check 'azd env get-values'." >&2
  exit 1
fi

echo "▸ Mobile rewire"
echo "  Backend URL: $WEB_URL"
echo ""

cd apps/mobile

if ! command -v npx >/dev/null 2>&1; then
  echo "✗ npx not found." >&2
  exit 1
fi

echo "▸ Updating EAS preview channel env (EXPO_PUBLIC_API_URL)"
# `eas env:create --force` is the idempotent "upsert": it creates the variable
# if missing, or overwrites it if it already exists. (`env:update` requires
# the variable to already exist and uses different flag names.)
set +e
npx --yes eas-cli env:create preview \
  --name EXPO_PUBLIC_API_URL \
  --value "$WEB_URL" \
  --type string \
  --visibility plaintext \
  --force \
  --non-interactive
EAS_EXIT=$?
set -e

if [[ $EAS_EXIT -ne 0 ]]; then
  echo "" >&2
  echo "  ↳ eas env:create failed (exit $EAS_EXIT)." >&2
  echo "    If you see an auth error above, run: npx eas-cli login" >&2
  echo "    If you see a 'project not configured' error, run from apps/mobile: npx eas-cli init" >&2
  exit 1
fi
echo "  ✓ EAS preview env updated"
echo ""

echo "▸ Triggering EAS Android preview build"
npx --yes eas-cli build \
  --platform android \
  --profile preview \
  --non-interactive

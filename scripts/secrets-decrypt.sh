#!/usr/bin/env bash
# Decrypt secrets/env.bundle.enc and restore .env.local + apps/mobile/.env.
# Usage:
#   AURAFIT_SECRETS_PASSPHRASE='your-passphrase' bash scripts/secrets-decrypt.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENC="$ROOT/secrets/env.bundle.enc"

pass="${AURAFIT_SECRETS_PASSPHRASE:-}"
if [[ -z "$pass" && -n "${AURAFIT_SECRETS_PASSPHRASE_FILE:-}" && -f "$AURAFIT_SECRETS_PASSPHRASE_FILE" ]]; then
  pass="$(cat "$AURAFIT_SECRETS_PASSPHRASE_FILE")"
fi
if [[ -z "$pass" ]]; then
  echo "Set AURAFIT_SECRETS_PASSPHRASE or AURAFIT_SECRETS_PASSPHRASE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENC" ]]; then
  echo "Missing $ENC — run scripts/secrets-encrypt.sh first" >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

openssl enc -aes-256-cbc -pbkdf2 -d \
  -in "$ENC" \
  -out "$TMP" \
  -pass "pass:$pass"

section=""
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    "=== .env.local ===")
      section="web"
      : > "$ROOT/.env.local"
      continue
      ;;
    "=== apps/mobile/.env ===")
      section="mobile"
      mkdir -p "$ROOT/apps/mobile"
      : > "$ROOT/apps/mobile/.env"
      continue
      ;;
    "=== azd env (aurafit-prod) ===")
      section="azd"
      continue
      ;;
    \#*)
      continue
      ;;
  esac
  case "$section" in
    web)  echo "$line" >> "$ROOT/.env.local" ;;
    mobile) echo "$line" >> "$ROOT/apps/mobile/.env" ;;
    azd)  :
      # azd values are reference-only in the bundle; import via scripts/azure-env-setup.sh
      ;;
  esac
done < "$TMP"

echo "Restored .env.local and apps/mobile/.env from encrypted bundle."
echo "For Azure azd env, run: npm run azure:setup"

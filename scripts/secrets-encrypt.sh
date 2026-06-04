#!/usr/bin/env bash
# Bundle local + azd secrets into an OpenSSL-encrypted archive (AES-256-CBC + PBKDF2).
# Usage:
#   AURAFIT_SECRETS_PASSPHRASE='your-passphrase' bash scripts/secrets-encrypt.sh
# Or set AURAFIT_SECRETS_PASSPHRASE_FILE to a file containing the passphrase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/secrets/env.bundle.enc"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass="${AURAFIT_SECRETS_PASSPHRASE:-}"
if [[ -z "$pass" && -n "${AURAFIT_SECRETS_PASSPHRASE_FILE:-}" && -f "$AURAFIT_SECRETS_PASSPHRASE_FILE" ]]; then
  pass="$(cat "$AURAFIT_SECRETS_PASSPHRASE_FILE")"
fi
if [[ -z "$pass" ]]; then
  echo "Set AURAFIT_SECRETS_PASSPHRASE or AURAFIT_SECRETS_PASSPHRASE_FILE" >&2
  exit 1
fi

mkdir -p "$ROOT/secrets"

bundle="$TMP/secrets-bundle.txt"
{
  echo "# Aurafit encrypted secrets bundle — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Decrypt: bash scripts/secrets-decrypt.sh"
  echo ""
  if [[ -f "$ROOT/.env.local" ]]; then
    echo "=== .env.local ==="
    cat "$ROOT/.env.local"
    echo ""
  fi
  if [[ -f "$ROOT/apps/mobile/.env" ]]; then
    echo "=== apps/mobile/.env ==="
    cat "$ROOT/apps/mobile/.env"
    echo ""
  fi
  if command -v azd >/dev/null 2>&1; then
    echo "=== azd env (aurafit-prod) ==="
    azd env get-values 2>/dev/null || true
    echo ""
  fi
} > "$bundle"

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$bundle" \
  -out "$OUT" \
  -pass "pass:$pass"

echo "Wrote encrypted bundle: secrets/env.bundle.enc"

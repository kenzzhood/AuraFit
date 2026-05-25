#!/usr/bin/env bash
# Verify Aurafit local setup. Run from repo root: ./scripts/check-setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

echo "=== Aurafit setup check ==="
echo ""

# Load env
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
  ok ".env.local found"
else
  fail ".env.local missing — copy from .env.example"
  exit 1
fi

# Node deps
if [[ -d node_modules/@prisma/client ]]; then
  ok "npm dependencies installed"
else
  fail "Run: npm install"
fi

# Required env vars
check_env() {
  local name="$1"
  local label="$2"
  if [[ -n "${!name:-}" ]]; then
    ok "$label"
  else
    fail "$label — set $name in .env.local"
  fi
}

echo ""
echo "--- Auth (Clerk) ---"
check_env NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "Clerk publishable key"
check_env CLERK_SECRET_KEY "Clerk secret key"

echo ""
echo "--- Azure Blob Storage ---"
check_env AZURE_STORAGE_ACCOUNT_NAME "Storage account name"
check_env AZURE_STORAGE_ACCOUNT_KEY "Storage account key"
check_env AZURE_STORAGE_CONNECTION_STRING "Storage connection string"

echo ""
echo "--- Azure OpenAI ---"
check_env AZURE_OPENAI_ENDPOINT "OpenAI endpoint"
check_env AZURE_OPENAI_API_KEY "OpenAI API key"

echo ""
echo "--- Database ---"
if [[ -n "${DATABASE_URL:-}" ]]; then
  ok "DATABASE_URL set"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -q '^aurafit-pg$'; then
      ok "Postgres container (aurafit-pg) running"
    else
      warn "Postgres container not running — run: docker compose -f docker-compose.postgres.yml up -d"
    fi
  else
    warn "Docker not running — start Docker Desktop, then run postgres compose"
  fi
else
  fail "DATABASE_URL not set"
fi

echo ""
echo "--- Product crawler ---"
if [[ -n "${PRODUCT_CRAWLER_URL:-}" ]]; then
  ok "Crawler URL: $PRODUCT_CRAWLER_URL"
  if curl -sf "${PRODUCT_CRAWLER_URL}/health" >/dev/null 2>&1; then
    ok "Crawler health check passed"
  else
    warn "Crawler not reachable — run: docker compose -f docker-compose.crawler.yml up --build"
  fi
else
  warn "PRODUCT_CRAWLER_URL not set"
fi

echo ""
echo "--- Optional ---"
if [[ -f apps/mobile/.env ]]; then
  if grep -q 'YOUR_LAN_IP' apps/mobile/.env 2>/dev/null; then
    warn "Mobile .env still has YOUR_LAN_IP placeholder"
  else
    ok "Mobile .env configured"
  fi
else
  warn "apps/mobile/.env missing"
fi

echo ""
echo "Done. Fix any ✗ items, then run: npm run dev"

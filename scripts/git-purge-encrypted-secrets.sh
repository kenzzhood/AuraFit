#!/usr/bin/env bash
# Remove secrets/env.bundle.enc from entire git history before making the repo public.
#
# WARNING: Rewrites history. Coordinate with all collaborators first.
# Run ONLY after rotating every secret that was inside the bundle.
#
# Usage:
#   bash scripts/git-purge-encrypted-secrets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "WARNING: You have uncommitted changes. Commit or stash before rewriting history."
  read -r -p "Continue anyway? [y/N] " dirty
  if [[ "${dirty,,}" != "y" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "Install git-filter-repo first: brew install git-filter-repo"
  exit 1
fi

echo "This will permanently remove secrets/env.bundle.enc from all commits."
echo "Ensure you have rotated all credentials that were in the bundle."
read -r -p "Continue? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

git filter-repo --path secrets/env.bundle.enc --invert-paths --force

echo ""
echo "Done. Next steps:"
echo "  1. git push origin main --force   # after team coordination"
echo "  2. Verify: git log -p -- secrets/env.bundle.enc  (should be empty)"

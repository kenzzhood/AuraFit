# Git history purge — `secrets/env.bundle.enc`

This guide removes the encrypted secrets bundle from **all commits** in git history. Required before making the repository public.

**Do not run until you use your own keys (not the original maintainer's).** See [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md).

---

## What the purge fixes

| State | Risk |
|-------|------|
| File deleted in working tree only | Remote still has bundle in commit `a2558fa` and earlier |
| History rewritten | Bundle bytes no longer recoverable from git |
| Credentials rotated | Even if someone cached the old blob, keys are invalid |

The script [`scripts/git-purge-encrypted-secrets.sh`](scripts/git-purge-encrypted-secrets.sh) uses [`git-filter-repo`](https://github.com/newren/git-filter-repo) to drop `secrets/env.bundle.enc` from every commit.

---

## Prerequisites

```bash
# macOS
brew install git-filter-repo

# Verify
git filter-repo --version
```

- All collaborators notified (history rewrite breaks existing clones)
- All credentials in git history are treated as compromised; use fresh keys from [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md)
- Clean working tree or changes stashed

---

## Backup procedure

1. **Clone a full backup** (keep offline until purge is verified):

   ```bash
   cd /tmp
   git clone --mirror git@github.com:YOUR_ORG/AuraFit.git aurafit-backup.git
   ```

2. **Export your local env separately** (outside git), e.g. copy `.env.local` to a password manager or `~/.aurafit/backup.env`

3. **Note current HEAD** for rollback reference:

   ```bash
   git rev-parse HEAD
   # Example: a2558fa...
   ```

---

## Execution steps

1. Commit or stash pending security fixes (including deletion of `secrets/env.bundle.enc`):

   ```bash
   git status
   git add -A
   git commit -m "Remove encrypted secrets bundle and add release security docs"
   ```

2. Run the purge script (interactive confirmation):

   ```bash
   bash scripts/git-purge-encrypted-secrets.sh
   ```

   Equivalent manual command:

   ```bash
   git filter-repo --path secrets/env.bundle.enc --invert-paths --force
   ```

3. Force-push rewritten history:

   ```bash
   git push origin main --force
   ```

4. All collaborators must re-clone or reset:

   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

---

## Verification commands

```bash
# Should print nothing
git log --all --oneline -- secrets/env.bundle.enc

# Should fail / not exist
git show HEAD:secrets/env.bundle.enc

# Confirm file is gitignored if recreated locally
touch secrets/env.bundle.enc
git status   # should show "ignored" or not listed

# Search history for high-entropy blobs (optional deep check)
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ {print $3, $4}' | sort -rn | head -20
```

---

## GitHub settings (after push)

1. Repository → **Settings** → **Code security and analysis**
2. Enable **Secret scanning**
3. Enable **Push protection**
4. (Optional) Run **GitHub Advanced Security** secret scanning on full history if available on your plan

---

## Rollback procedure

If something goes wrong **before** force-push:

- Your local backup mirror at `/tmp/aurafit-backup.git` is unchanged.
- Restore: `git clone /tmp/aurafit-backup.git restored-aurafit`

If force-push already happened:

- Restore from backup mirror and force-push the old refs **only if** you accept re-exposing the bundle (not recommended).
- Preferred: fix forward — ensure rotation is complete and re-run purge.

---

## Script safety review

| Check | Status |
|-------|--------|
| Targets only `secrets/env.bundle.enc` | Yes — narrow path filter |
| Requires explicit confirmation | Yes — `[y/N]` prompt |
| Uses `--force` for filter-repo | Required when repo is not a fresh clone |
| Does not auto-push | Correct — manual push step |
| Installs check | Exits if `git-filter-repo` missing |

**Limitation:** If other secrets were committed under different paths, extend the purge:

```bash
git filter-repo --path secrets/ --invert-paths --force   # removes entire secrets/ history
```

Only do this if no non-secret files in `secrets/` need to remain in history (currently only `README.md` should stay — prefer path-specific purge).

---

## Expected results

- `secrets/env.bundle.enc` absent from all commits
- `secrets/README.md` remains (if committed before purge)
- Commit SHAs change for all commits that touched the file
- Remote clone size may shrink slightly after `git gc`

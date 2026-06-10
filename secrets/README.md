# Secrets in this repository

**This repo contains no API keys, Clerk credentials, or connection strings.**

Each developer and deployer must supply their own. See:

**→ [docs/SETUP_YOUR_KEYS.md](../docs/SETUP_YOUR_KEYS.md)**

Store secrets only in gitignored files:

- `.env.local`
- `apps/mobile/.env`
- `.azure/` (Azure Developer CLI local state)

Never commit `secrets/*.enc` or encrypted bundles.

If credentials were ever committed to git history, follow [GIT_HISTORY_PURGE.md](../GIT_HISTORY_PURGE.md) after rotating keys in your provider dashboards.

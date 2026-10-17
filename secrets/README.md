# Secrets in this repository

**This repo contains no API keys, Clerk credentials, or connection strings.**

Each developer and deployer must supply their own. See:

**→ [docs/SETUP_YOUR_KEYS.md](../docs/SETUP_YOUR_KEYS.md)**

Store secrets only in gitignored files:

- `.env.local`
- `apps/mobile/.env`
- `.azure/` (Azure Developer CLI local state)

Optional crawler unlockers (leave empty to skip; crawler container only, never the web app):

- `BRIGHTDATA_API_TOKEN`
- `BRIGHTDATA_WEB_UNLOCKER_ZONE`
- `OXYLABS_USERNAME`
- `OXYLABS_PASSWORD`

Never commit `secrets/*.enc` or encrypted bundles.

If credentials were ever committed to git history, follow [docs/security/git-history-purge.md](../docs/security/git-history-purge.md) after rotating keys in your provider dashboards.

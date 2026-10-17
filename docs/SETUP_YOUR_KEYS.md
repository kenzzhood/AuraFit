# Set up your own API keys

AuraFit ships **without any credentials**. Every fork and clone must use **your own** accounts and keys.

Nothing in this repository should contain real secrets. Store keys only in:

| Location | Gitignored? |
|----------|-------------|
| `.env.local` (web) | Yes |
| `apps/mobile/.env` (mobile) | Yes |
| `.azure/` (Azure Developer CLI) | Yes |
| GitHub Actions → Secrets | N/A |
| EAS → Project secrets (mobile builds) | N/A |

---

## Quick start (minimum viable local dev)

```bash
cp .env.example .env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in at least the **Required** section below, then:

```bash
npm install
npm run db:push          # needs DATABASE_URL
npm run dev              # http://localhost:3000
```

---

## Required keys

### 1. Authentication — Clerk

AuraFit uses [Clerk](https://clerk.com) for sign-in on web and mobile.

1. Create a free app at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Go to **Configure → API Keys**.
3. Copy **Publishable key** and **Secret key**.

**.env.local**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
```

**apps/mobile/.env**

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx   # same publishable key as web
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000          # e.g. http://192.168.1.5:3000
```

4. In Clerk → **Configure → Paths** (or URLs): add your origins:
   - `http://localhost:3000`
   - Your production URL when deployed
   - Expo dev URLs if testing mobile (`exp://…`)

> **Never commit** Clerk keys. Each developer and deployment uses their own Clerk application.

---

### 2. Database — PostgreSQL

You need Postgres with the **pgvector** extension.

**Option A — Docker (local)**

```bash
docker compose -f docker-compose.postgres.yml up -d
```

The compose file publishes Postgres on port **54322** as user `postgres`, database `postgres`.

```bash
DATABASE_URL=postgresql://postgres:aurafit_local_dev@127.0.0.1:54322/postgres
```

**Option B — [Supabase](https://supabase.com)** (free tier)

1. Create a project.
2. SQL Editor → run `supabase/pgvector.sql`.
3. Copy the connection string (URI).

**Option C — Azure Postgres** (created by `azd up` — see [docs/deploy/azure-runbook.md](../deploy/azure-runbook.md))

Then:

```bash
npm run db:push
```

---

### 3. AI — Azure OpenAI (recommended)

Without this, generation falls back to demo/heuristic behavior.

1. Create an **Azure OpenAI** resource in [Azure Portal](https://portal.azure.com).
2. Deploy models (Azure OpenAI Studio):
   - Chat: `gpt-4o` (or similar)
   - Embeddings: `text-embedding-3-large`
   - Images: `dall-e-3` or `gpt-image-*`
3. Copy endpoint + keys from **Keys and Endpoint**.

```bash
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT_GPT4O=gpt-4o
AZURE_OPENAI_DEPLOYMENT_EMBED=text-embedding-3-large
AZURE_OPENAI_DEPLOYMENT_IMAGE=dall-e-3
AZURE_OPENAI_API_VERSION=2024-10-01-preview

# If image resource is separate:
AZURE_OPENAI_IMAGE_ENDPOINT=https://YOUR-IMAGE-RESOURCE.openai.azure.com
AZURE_OPENAI_IMAGE_API_KEY=
```

---

## Storage (pick one)

### Cloudinary

```bash
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Sign up: [cloudinary.com](https://cloudinary.com)

### Azure Blob

```bash
STORAGE_PROVIDER=azure
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_ACCOUNT_KEY=
AZURE_STORAGE_CONNECTION_STRING=
```

Create a storage account and containers: `wardrobes`, `outfits`, `profiles`.

---

## Product crawler (real shopping links)

**Local:**

```bash
export CRAWLER_API_KEY=$(openssl rand -hex 32)
echo "CRAWLER_API_KEY=$CRAWLER_API_KEY" >> .env.local
echo "PRODUCT_CRAWLER_URL=http://localhost:8100" >> .env.local

docker compose -f docker-compose.crawler.yml up --build
```

**Azure:** the crawler Container App is deployed with `azd up`. Generate a key and pass it via `npm run azure:setup` (reads from your `.env.local`).

The same `CRAWLER_API_KEY` must match on **web** and **crawler**.

---

## Optional keys

| Variable | When you need it | Where to get it |
|----------|------------------|-----------------|
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Background jobs in production | [inngest.com](https://www.inngest.com) |
| `REDIS_URL` | Distributed rate limits (multi-instance) | Upstash, Azure Cache for Redis |
| `SERPAPI_KEY` | Emergency product search fallback | [serpapi.com](https://serpapi.com) |
| `BRIGHTDATA_API_TOKEN` / `BRIGHTDATA_WEB_UNLOCKER_ZONE` | Optional crawler fetch ladder (Web Unlocker). Crawler container only. | [brightdata.com](https://brightdata.com) |
| `OXYLABS_USERNAME` / `OXYLABS_PASSWORD` | Optional crawler fetch ladder (Realtime Universal). Crawler container only. | [oxylabs.io](https://oxylabs.io) |
| `REPLICATE_API_TOKEN` | Virtual try-on | [replicate.com](https://replicate.com) |
| `OPENAI_API_KEY` | Fallback if not using Azure OpenAI | [platform.openai.com](https://platform.openai.com) |
| `INGEST_API_KEY` | Scrapy indexer ingest only | `openssl rand -hex 32` (you choose) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics | [posthog.com](https://posthog.com) |
| `SENTRY_DSN` | Error tracking | [sentry.io](https://sentry.io) |

---

## Azure deployment (your keys → azd)

After `.env.local` is filled with **your** values:

```bash
npm run azure:setup    # pushes keys into azd env (stored in .azure/, gitignored)
npm run azure:up       # provision + deploy
npm run azure:db-init  # schema + pgvector
```

Required in `.env.local` for Azure setup:

- Clerk keys
- Azure OpenAI (chat + image)
- Azure Storage account keys

`CRAWLER_API_KEY` is auto-generated on first `azure:setup` if not set.

Full runbook: [docs/deploy/azure-runbook.md](../deploy/azure-runbook.md)

---

## Mobile production builds (EAS)

Never put secrets in `eas.json`. Use EAS secrets:

```bash
cd apps/mobile
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://your-api.example.com
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value pk_live_xxx
eas build --platform android --profile preview
```

Guide: [docs/MOBILE_BUILD.md](MOBILE_BUILD.md)

---

## Verify your setup

```bash
npm run setup:check     # checks required env vars
npm run type-check
npm test
npm run dev
```

Sign in at `/sign-in`, upload a photo, run generation at `/generate`.

---

## Security rules

1. **Do not commit** `.env`, `.env.local`, or `apps/mobile/.env`.
2. **Do not commit** encrypted key bundles or `.azure/` state.
3. Use **your own** Clerk app — never share production keys in issues or PRs.
4. Enable **GitHub secret scanning** on public repos.
5. If keys were ever committed, rotate them in the provider dashboard and purge git history — [docs/security/git-history-purge.md](../security/git-history-purge.md).

---

## Variable reference

See [`.env.example`](../.env.example) for the full list of supported environment variables and defaults.

# Deployment checklist

Use this to deploy AuraFit from scratch with **only** repository documentation and your own cloud accounts.

Two supported paths:

| Path | Best for | Guide |
|------|----------|-------|
| **Azure Container Apps** | Production demo, hackathon live URL, cost pause/resume | [azure-runbook.md](azure-runbook.md) |
| **Vercel + Supabase** | Fast hackathon MVP, minimal ops | [../hackathon/setup.md](../hackathon/setup.md) |

---

## Phase 0 — Prerequisites

- [ ] Node.js 22+ and npm
- [ ] Python 3.11+ (crawler tests / local crawler)
- [ ] Docker (optional: local Postgres, local crawler)
- [ ] Git clone of this repository
- [ ] Accounts: Clerk, Azure (or Vercel + Supabase), Cloudinary or Azure Storage

```bash
git clone https://github.com/YOUR_ORG/AuraFit.git
cd AuraFit
npm install
cp .env.example .env.local
cp apps/mobile/.env.example apps/mobile/.env
```

---

## Phase 1 — External services

### Clerk (required)

- [ ] Create application at [dashboard.clerk.com](https://dashboard.clerk.com)
- [ ] Enable Email + Google (optional)
- [ ] Add redirect URLs: `http://localhost:3000/*`, production URL, Expo scheme if needed
- [ ] Copy publishable + secret keys → `.env.local` and `apps/mobile/.env`

### Database (required)

**Option A — Local Postgres**

```bash
docker compose -f docker-compose.postgres.yml up -d
# DATABASE_URL=postgresql://postgres:aurafit_local_dev@127.0.0.1:54322/postgres
npm run db:push
```

**Option B — Supabase** — see [../hackathon/setup.md](../hackathon/setup.md)

**Option C — Azure Postgres** — created by `azd up`; bootstrap with `npm run azure:db-init`

- [ ] pgvector extension enabled (`scripts/db-create-extensions.mjs` or `db-init.sh`)
- [ ] Prisma schema applied (`npm run db:push` or `db-migrate-deploy.sh`)

### Storage (required for uploads)

**Cloudinary** (simplest):

- [ ] `STORAGE_PROVIDER=cloudinary`
- [ ] Set `CLOUDINARY_*` in `.env.local`

**Azure Blob**:

- [ ] Create storage account + containers: `wardrobes`, `outfits`, `profiles`
- [ ] Set `STORAGE_PROVIDER=azure` and `AZURE_STORAGE_*`

### Azure OpenAI (required for full AI features)

- [ ] Deploy `gpt-4o` (chat), `text-embedding-3-large` (embeddings)
- [ ] Deploy image model (`dall-e-3` or `gpt-image-*`)
- [ ] Set `AZURE_OPENAI_*` in `.env.local`
- [ ] Optional: Azure AI Vision for wardrobe tagging

### Product crawler (required for real product links without SerpAPI)

**Local:**

```bash
export CRAWLER_API_KEY=$(openssl rand -hex 32)
docker compose -f docker-compose.crawler.yml up --build
# PRODUCT_CRAWLER_URL=http://localhost:8100
```

**Azure:** deployed automatically as internal Container App — see [azure-runbook.md](azure-runbook.md)

- [ ] `CRAWLER_API_KEY` matches on web and crawler
- [ ] `PRODUCT_DISCOVERY_LAYERS=cache,index,shopping,crawl` (default in `.env.example`)

### Queue (recommended for production)

**Inngest:**

- [ ] Create app at [inngest.com](https://www.inngest.com)
- [ ] Set `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- [ ] Register sync URL: `https://YOUR-DOMAIN/api/inngest`
- [ ] `QUEUE_PROVIDERS=inngest,inline`

**Without Inngest:** `QUEUE_PROVIDERS=inline` (jobs run in-process — OK for dev)

### Redis (recommended for production rate limits)

- [ ] Provision Redis (Azure Cache, Upstash, etc.)
- [ ] Set `REDIS_URL=rediss://...`
- [ ] Without Redis, rate limits fall back to in-memory (single-instance only)

---

## Phase 2 — Local verification

```bash
npm run type-check
npm test
cd services/product-crawler && python3 -m pytest tests/ -q
npm run dev
```

- [ ] `http://localhost:3000` loads
- [ ] Sign up / sign in works
- [ ] Upload photo → generate → status reaches DONE
- [ ] Product links resolve (crawler or demo fallback)

---

## Phase 3 — Azure production deploy

```bash
az login && azd auth login
npm run azure:setup      # pushes .env.local → azd env
npm run azure:up         # provision + build + deploy (~10 min)
npm run azure:db-init    # pgvector + migrations
```

- [ ] Web URL responds: `curl https://YOUR-URL/api/health`
- [ ] Clerk production URLs updated
- [ ] Mobile rewire: `npm run mobile:rewire` (sets `EXPO_PUBLIC_API_URL`)

### Cost control

```bash
npm run azure:stop    # scale apps to 0, stop Postgres
npm run azure:start   # resume for demos
npm run azure:status  # verify state
```

---

## Phase 4 — Mobile app

```bash
cd apps/mobile
eas login
eas init   # first time only
eas build --platform android --profile preview
```

- [ ] `EXPO_PUBLIC_API_URL` points to deployed API
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` matches Clerk app
- [ ] APK installs and authenticates

See [docs/MOBILE_BUILD.md](docs/MOBILE_BUILD.md).

---

## Phase 5 — Production hardening

- [ ] Use your own keys per [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md)
- [ ] Purge git history ([../security/git-history-purge.md](../security/git-history-purge.md))
- [ ] Postgres firewall restricted (not `0.0.0.0/0` except temporary db-init)
- [ ] `AZURE_BLOB_READ_SAS_MINUTES=60` (default)
- [ ] GitHub secret scanning enabled
- [ ] Sentry / PostHog configured (optional)

---

## Phase 6 — Smoke test matrix

| Test | Command / action | Expected |
|------|------------------|----------|
| Health | `GET /api/health` | `{ "ok": true }` |
| Auth | Sign in on web | Redirect to `/generate` |
| Upload | POST `/api/upload` | Returns storage URL |
| Generate | POST `/api/generate` | Job ID, status polling works |
| Products | GET `/api/products/search?q=...` | Products or session ID |
| Chat | POST `/api/chat` | Stream response |
| Rate limit | Rapid requests | 429 with retry header |
| Mobile | Full flow on device | No 401/404 on API |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 on mobile API | Check Clerk keys + `CORS_ALLOWED_ORIGINS` |
| Generation stuck | Check Inngest sync or set `QUEUE_PROVIDERS=inline` |
| No product links | Start crawler; verify `CRAWLER_API_KEY` |
| DB connection failed | Firewall rule, SSL mode, correct `DATABASE_URL` |
| Azure high cost | Run `npm run azure:stop` immediately |

---

## Reference files

| File | Purpose |
|------|---------|
| `.env.example` | All environment variables |
| `azure.yaml` | azd service manifest |
| `infra/main.bicep` | Azure infrastructure |
| `Dockerfile` | Web container |
| `services/product-crawler/Dockerfile` | Crawler container |
| `prisma/schema.prisma` | Database schema |

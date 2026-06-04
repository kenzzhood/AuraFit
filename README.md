# AuraFit

AI-native fashion styling: upload your photo, get six editorial looks, shop with real links.

## Stack

- **Backend:** Next.js 15, Prisma, PostgreSQL, Clerk, Inngest
- **Mobile:** Expo (React Native) in `apps/mobile`
- **AI:** Provider-agnostic (`azure` | `openai` | `gemini`)
- **Storage:** Cloudinary or Azure Blob

## Quick start (backend)

```bash
cp .env.example .env.local
# Fill DATABASE_URL, Clerk, Cloudinary, Azure OpenAI

docker start aurafit-pg   # or use Supabase DATABASE_URL
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Style** (`/generate`).

## Quick start (mobile)

See [docs/mobile-setup.md](docs/mobile-setup.md).

```bash
npm install
npm run dev              # API on :3000
npm run dev:mobile       # Expo
```

## V2 docs

- [Architecture](docs/architecture-v2.md)
- [Product discovery & crawling](docs/product-discovery.md)
- [Hackathon / infra runbook](HACKATHON_SETUP.md)
- [Azure setup](docs/AZURE_SETUP.md)

## Core env vars

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Auth |
| `CLOUDINARY_*` | Image storage |
| `AI_PROVIDERS` | Comma order: `azure,openai,gemini` |
| `IMAGE_PROVIDERS` | Board images: `azure,openai,noop` |
| `PRODUCT_SEARCH_PROVIDERS` | `serpapi,demo` |
| `QUEUE_PROVIDERS` | `inngest,service-bus,inline` |
| `CACHE_PROVIDER` | `memory` or `redis` |
| `AZURE_OPENAI_*` | Chat, vision, embeddings, DALL-E |
| `SERPAPI_KEY` | Real shopping links |
| `GENERATION_PREVIEW_ONLY` | Default preview until HD requested |

See `.env.example` for full provider list.

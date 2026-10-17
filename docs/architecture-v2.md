# Aurafit V2 Architecture

## Product flow

```
Upload photo → Style preferences → Generate (preview) → Pick look → Shop / Refine / HD render
```

## Repositories

| Layer | Path | Role |
|-------|------|------|
| Backend API | `/` (Next.js) | Auth, AI orchestration, jobs, affiliate |
| Mobile app | `apps/mobile` (Expo) | Premium native UX, local-first photos |

## Provider modular system

Each external dependency is swappable via comma-separated env order. Shared fallback runner: [`src/lib/providers/fallback.ts`](../src/lib/providers/fallback.ts).

| System | Env | Default order | Entry |
|--------|-----|---------------|-------|
| AI (chat, vision, looks) | `AI_PROVIDERS` | `azure,openai,gemini` | [`src/lib/ai/provider.ts`](../src/lib/ai/provider.ts) |
| Image (fashion board) | `IMAGE_PROVIDERS` | `azure,openai,noop` | [`src/lib/image/provider.ts`](../src/lib/image/provider.ts) |
| Try-on | `TRYON_PROVIDERS` | `replicate,noop` | [`src/lib/tryon/provider.ts`](../src/lib/tryon/provider.ts) |
| Product discovery | `PRODUCT_DISCOVERY_LAYERS` | `cache,index,shopping,crawl` | [`src/lib/ecommerce/discovery.ts`](../src/lib/ecommerce/discovery.ts) |
| Live crawler | `PRODUCT_CRAWLER_URL` | Docker `:8100` | [`services/product-crawler/`](../services/product-crawler/) |
| Cache | `CACHE_PROVIDER` | `memory` (or `redis` + `REDIS_URL`) | [`src/lib/cache/provider.ts`](../src/lib/cache/provider.ts) |
| Affiliate links | `AFFILIATE_PROVIDERS` | `amazon,generic` | [`src/lib/ecommerce/affiliate/provider.ts`](../src/lib/ecommerce/affiliate/provider.ts) |
| Queue | `QUEUE_PROVIDERS` | `inngest,service-bus,inline` | [`src/lib/queue/provider.ts`](../src/lib/queue/provider.ts) |
| Storage | `STORAGE_PROVIDER` | `cloudinary` | [`src/lib/storage/provider.ts`](../src/lib/storage/provider.ts) |

Failures return `providerMeta` on generation results (`degraded`, `failures[]`) so clients can show continuity when a subsystem is down.

## Storage providers

Set `STORAGE_PROVIDER=cloudinary|azure`. Uploads use `getStorageProvider()`.

## Generation pipeline

1. **Preview** (`renderQuality: "preview"` or `previewOnly: true`): person analysis → 6 look plans → products. No board image.
2. **Medium** (`renderQuality: "medium"`): adds lower-cost board image when image providers are configured.
3. **HD** (`renderQuality: "hd"` or `POST /api/generate/hd`): full-quality board on demand.

## Local-first (mobile)

- Selfies and wardrobe photos: device filesystem + SQLite metadata
- Cloud: embeddings, job results, generated renders, affiliate clicks

## Social features

Routes and Prisma models remain but navigation is hidden until V2 mobile is stable.

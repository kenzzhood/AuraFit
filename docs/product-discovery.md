# Product Discovery Architecture

## Flow

```
Client → discoverProducts()
  1. Query cache (Redis/memory)
  2. ProductIndex (Postgres + pgvector)
  3. Enqueue live crawl (async, never blocks)
  4. Optional SerpAPI / demo fallback
  → Rank (embeddings + heuristics) → return immediately
```

Poll `GET /api/products/session/[id]` for enriched products after background crawl.

## Local development

### Without crawler (fastest)

```env
PRODUCT_DISCOVERY_LAYERS=cache,index,demo
```

### With Docker crawler

```bash
docker compose -f docker-compose.crawler.yml up --build
```

```env
PRODUCT_DISCOVERY_LAYERS=cache,index,crawl,demo
PRODUCT_CRAWLER_URL=http://localhost:8100
CRAWLER_API_KEY=dev-crawler-key
```

### Scrapy batch ingest (background)

```bash
cd services/scrapy-indexer
pip install -r requirements.txt
scrapy crawl fashion_catalog -o out/products.jsonl
INGEST_API_KEY=your-key AURAFIT_API_URL=http://localhost:3000 \
  python scripts/ingest_jsonl.py out/products.jsonl
```

## API routes

| Route | Purpose |
|-------|---------|
| `GET /api/products` | Discover products (layered) |
| `GET /api/products/search` | Same with session support |
| `GET /api/products/session/[id]` | Poll progressive crawl results |
| `POST /api/internal/index/ingest` | Scrapy batch ingest (x-ingest-key) |

## Key modules

- [`src/lib/ecommerce/discovery.ts`](../src/lib/ecommerce/discovery.ts) — orchestrator
- [`src/lib/ecommerce/index/`](../src/lib/ecommerce/index/) — persist, embeddings, search
- [`src/lib/ecommerce/ranking/engine.ts`](../src/lib/ecommerce/ranking/engine.ts) — AI ranking
- [`services/product-crawler/`](../services/product-crawler/) — Playwright + Crawl4AI
- [`services/scrapy-indexer/`](../services/scrapy-indexer/) — scheduled indexing only

## Cost controls

- Live crawl only when index + cache return fewer than `PRODUCT_CRAWL_MIN_RESULTS`
- Embeddings cached by content hash
- Page HTML cached 7 days (`CRAWL_PAGE_CACHE_TTL_SECONDS`)
- SerpAPI optional via `PRODUCT_DISCOVERY_LAYERS`

# Product Discovery Architecture

## Flow

```
Client → discoverProducts()
  1. Query cache (Redis/memory) — ranked pool, 6h TTL
  2. ProductIndex (Postgres + pgvector) — merge, do not stop at 4 hits
  3. Google Shopping (SerpAPI when keyed, else self-hosted crawler)
  4. Enqueue live crawl when the candidate pool is still thin or single-retailer
  → Rank (embeddings + region/TLD + heuristics) → return the pool
```

Generation then:
- fans out 2–3 query variants on the hero slot (dress / primary garment)
- searches every configured store (Amazon, Myntra, Ajio, Flipkart, Nykaa,
  Zara, H&M, Snitch, Banana Club, and the rest) with a per-store cap so one
  shop cannot fill the quota
- interleaves ranked results by retailer so the pool looks like a Google
  shopping page, then scores each garment like a stylist: price vs budget,
  fabric, design, quality cues, brand, ratings, stock, and fit with the look
- picks with board-level URL / title-fingerprint uniqueness; the per-retailer
  cap is soft (two-pass) so a repeated store never leaves a slot empty
- trusts live shopping listings as buyable; PDP-rechecks only stale (>7 d)
  crawler rows and never-verified snippets, max 2 checks per slot. A failed
  recheck keeps once-verified listings and burns only never-verified ones
- drops any look that still has zero verified products from the rendered board
- reranks top-3 alternates per slot into a coherent combo
- keeps searching live shopping until Amazon / Myntra / Ajio (or 2+ core
  marketplaces) are in the pool — boutique cache hits cannot stop discovery

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
PRODUCT_DISCOVERY_LAYERS=cache,index,shopping,crawl,demo
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

- Live crawl only when the candidate pool is still thin (`PRODUCT_CANDIDATE_POOL_TARGET`, default 20) or single-retailer
- Embeddings cached by content hash
- Page HTML cached 7 days (`CRAWL_PAGE_CACHE_TTL_SECONDS`)
- SerpAPI is the default shopping backend when `SERPAPI_KEY` is set; otherwise the self-hosted Google Shopping crawler runs

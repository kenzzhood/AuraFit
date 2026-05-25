# Aurafit Scrapy Indexer (background only)

Scheduled batch ingestion — **not** used for realtime user search.

## Setup

```bash
cd services/scrapy-indexer
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run spider (example)

```bash
scrapy crawl fashion_catalog -o out/products.jsonl
```

## Ingest to Aurafit API

```bash
export INGEST_API_KEY=your-key
export AURAFIT_API_URL=http://localhost:3000
python scripts/ingest_jsonl.py out/products.jsonl
```

Configure cron / Inngest cron / Azure Container Apps Job for production schedules.

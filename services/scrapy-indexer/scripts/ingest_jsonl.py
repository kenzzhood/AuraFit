#!/usr/bin/env python3
"""POST JSONL products to Aurafit internal ingest API."""
import json
import os
import sys

import httpx

API_URL = os.environ.get("AURAFIT_API_URL", "http://localhost:3000")
INGEST_KEY = os.environ.get("INGEST_API_KEY", "")


def main(path: str) -> None:
    products = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                products.append(json.loads(line))

    batch_size = 50
    for i in range(0, len(products), batch_size):
        batch = products[i : i + batch_size]
        res = httpx.post(
            f"{API_URL}/api/internal/index/ingest",
            json={"products": batch, "source": "scrapy", "region": "IN"},
            headers={"x-ingest-key": INGEST_KEY},
            timeout=60.0,
        )
        res.raise_for_status()
        print(f"Ingested batch {i // batch_size + 1}: {res.json()}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ingest_jsonl.py <products.jsonl>")
        sys.exit(1)
    main(sys.argv[1])

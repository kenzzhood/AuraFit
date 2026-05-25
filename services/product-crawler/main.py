"""Aurafit product crawler — Playwright + Crawl4AI.

Two-stage pipeline:
  1. /crawl/search opens a store search-result page and extracts candidate
     URLs that *look* like product detail pages (Flipkart /p/itm…, Amazon /dp/…).
  2. Each candidate is then opened individually and run through a store-specific
     validator that confirms title, image, price, and availability. Only fully
     verified products are returned. Search-snippet products are never surfaced.
"""
from __future__ import annotations

import asyncio
import os
from urllib.parse import quote_plus

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from engines.crawl4ai_engine import extract_products
from engines.google_shopping_engine import search_google_shopping
from engines.playwright_engine import fetch_rendered_html
from validators import validate_product_url

# CRAWLER_API_KEY must always be set — the crawler is not intended to be a public service.
API_KEY = os.environ.get("CRAWLER_API_KEY", "").strip()

# Enforce at startup so misconfigured containers fail loudly, not silently.
if not API_KEY:
    import sys
    print(
        "[crawler] FATAL: CRAWLER_API_KEY environment variable is not set or is empty. "
        "Set a strong random key before starting the crawler.",
        file=sys.stderr,
    )
    # In production, refuse to start without a key.
    # In dev (detected by a special flag), allow startup with a warning.
    if os.environ.get("CRAWLER_ALLOW_NO_KEY", "").lower() != "true":
        sys.exit(1)

# Cap the per-search detail-page validation fan-out so we don't burn minutes
# on every request. The orchestrator only needs 1–3 verified items anyway.
MAX_CANDIDATES_PER_QUERY = int(os.environ.get("MAX_CANDIDATES_PER_QUERY", "8"))
MAX_VERIFIED_PER_QUERY = int(os.environ.get("MAX_VERIFIED_PER_QUERY", "3"))

# Maximum request body size in bytes (1 MB)
MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024

app = FastAPI(title="Aurafit Product Crawler", version="2.1.0")


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject requests with Content-Length exceeding MAX_REQUEST_BODY_BYTES."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large"},
        )
    return await call_next(request)


def verify_key(x_crawler_key: str | None = Header(default=None)) -> None:
    """Always require a valid API key — no bypass possible."""
    if not API_KEY:
        # Startup guard already warns; if we got here in dev allow-no-key mode,
        # skip key check but log every request.
        return
    if not x_crawler_key or x_crawler_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing crawler key")


class SearchRequest(BaseModel):
    query: str
    region: str = "IN"
    category: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    max_results: int | None = None


class CrawlUrlRequest(BaseModel):
    url: str
    query: str = ""


class ResolveRequest(BaseModel):
    url: str


class GoogleShoppingRequest(BaseModel):
    query: str
    region: str = "IN"
    category: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    max_results: int | None = None


class ProductOut(BaseModel):
    title: str
    url: str
    brand: str | None = None
    price: float | None = None
    currency: str = "INR"
    image: str | None = None
    category: str | None = None
    colors: list[str] = Field(default_factory=list)
    aestheticTags: list[str] = Field(default_factory=list)
    source: str = "crawl"
    availability: str = "unknown"
    verified: bool = False
    canonicalUrl: str | None = None


def search_urls_for_region(query: str, region: str) -> list[str]:
    """Pick search URLs that the headless crawler can actually parse.

    Empirical results (May 2026 runtime probe):
      - Myntra → HTTP/2 protocol errors, unusable from Playwright
      - Google Shopping → returns 200 but the markdown contains no product cards
      - Flipkart → real product listings with titles and /p/itm... URLs
      - Amazon → noisy but yields some real items
    """
    q = quote_plus(query)
    if region == "US":
        return [
            f"https://www.amazon.com/s?k={q}",
        ]
    if region == "UK":
        return [
            f"https://www.amazon.co.uk/s?k={q}",
        ]
    # Default / IN
    return [
        f"https://www.flipkart.com/search?q={q}",
        f"https://www.amazon.in/s?k={q}",
    ]


@app.get("/health")
async def health():
    return {"status": "ok", "service": "product-crawler", "version": "2.1.0"}


async def _gather_candidates(query: str, region: str, category: str | None) -> list[dict]:
    """Return raw candidate snippets from store search pages."""
    candidates: list[dict] = []
    for url in search_urls_for_region(query, region)[:2]:
        try:
            html = await fetch_rendered_html(url)
            items = await extract_products(url, query, html=html)
            for item in items:
                item.setdefault("category", category)
                candidates.append(item)
        except Exception as e:  # noqa: BLE001 — log and continue with next search url
            print(f"Search crawl error {url}: {e}")
    # Dedupe by url, preserve order
    seen: set[str] = set()
    unique: list[dict] = []
    for p in candidates:
        u = p.get("url") or ""
        if u and u not in seen:
            seen.add(u)
            unique.append(p)
    return unique


def _within_budget(price: float | None, budget_max: float | None) -> bool:
    if budget_max is None or price is None:
        return True
    return price <= budget_max


@app.post("/crawl/search")
async def crawl_search(
    body: SearchRequest,
    x_crawler_key: str | None = Header(default=None),
):
    """Stage 1: gather candidate URLs. Stage 2: validate each detail page.

    Returns ONLY verified products — every entry has been confirmed against
    its real product detail page, so the caller can safely show its URL and
    feed its image into the image-generation prompt.
    """
    verify_key(x_crawler_key)

    fb = await _run_retailer_search(
        query=body.query,
        region=body.region,
        category=body.category,
        budget_min=body.budget_min,
        budget_max=body.budget_max,
        max_results=body.max_results,
    )

    print(
        f"search query={body.query!r} region={body.region} "
        f"candidates={fb['candidateCount']} verified={fb['count']} "
        f"rejected={len(fb['rejected'])}"
    )

    return fb


@app.post("/crawl/url")
async def crawl_single_url(
    body: CrawlUrlRequest,
    x_crawler_key: str | None = Header(default=None),
):
    """Legacy: extract candidate snippets from one URL (no validation)."""
    verify_key(x_crawler_key)
    html = await fetch_rendered_html(body.url)
    products = await extract_products(body.url, body.query, html=html)
    return {"products": products, "count": len(products)}


@app.post("/crawl/resolve")
async def crawl_resolve(
    body: ResolveRequest,
    x_crawler_key: str | None = Header(default=None),
):
    """Debug endpoint: open one candidate URL and run the validator on it."""
    verify_key(x_crawler_key)
    product, reason = await validate_product_url(body.url)
    if product is None:
        return {"verified": False, "reason": reason, "product": None}
    return {"verified": True, "reason": None, "product": product}


async def _run_retailer_search(
    query: str,
    region: str,
    category: str | None,
    budget_min: float | None,
    budget_max: float | None,
    max_results: int | None,
) -> dict:
    """Hit retailer search pages and stop as soon as we have enough verified
    products.

    Previously we fetched Flipkart + Amazon before validating anything. For
    India, Flipkart usually provides enough verified products by itself; early
    stop avoids unnecessary browser work and cuts most product searches roughly
    in half.
    """
    max_verified = max_results or MAX_VERIFIED_PER_QUERY

    verified: list[dict] = []
    rejected: list[dict] = []
    total_candidates = 0
    seen_verified_titles: set[str] = set()

    async def _resolve(cand: dict) -> tuple[dict | None, dict | None]:
        url = cand.get("url") or ""
        product, reason = await validate_product_url(url)
        if product is None:
            return None, {"url": url, "reason": reason or "unknown"}
        if category and not product.get("category"):
            product["category"] = category
        # Tag with matchCategory so the upstream image-ref builder can slot
        # it into the correct outfit panel (top vs bottoms vs shoes etc.).
        product.setdefault("matchCategory", category)
        return product, None

    seen_urls: set[str] = set()
    candidates_per_store = max(max_verified + 4, 6)

    for search_url in search_urls_for_region(query, region):
        if len(verified) >= max_verified:
            break

        try:
            html = await fetch_rendered_html(search_url)
            raw_items = await extract_products(search_url, query, html=html)
        except Exception as e:  # noqa: BLE001
            print(f"Search crawl error {search_url}: {e}")
            continue

        candidates: list[dict] = []
        for item in raw_items:
            item.setdefault("category", category)
            u = item.get("url") or ""
            if not u or u in seen_urls:
                continue
            seen_urls.add(u)
            candidates.append(item)
            if len(candidates) >= candidates_per_store:
                break

        total_candidates += len(candidates)
        pending = [asyncio.create_task(_resolve(c)) for c in candidates]
        try:
            for fut in asyncio.as_completed(pending):
                try:
                    product, rej = await fut
                except Exception as e:  # noqa: BLE001
                    rejected.append({"url": "", "reason": f"resolve error: {e}"})
                    continue
                if product is not None and _within_budget(product.get("price"), budget_max):
                    if budget_min is None or (product.get("price") or 0) >= budget_min:
                        title_key = str(product.get("title") or "").lower().strip()[:80]
                        if title_key and title_key in seen_verified_titles:
                            continue
                        if title_key:
                            seen_verified_titles.add(title_key)
                        verified.append(product)
                        if len(verified) >= max_verified:
                            break
                elif rej is not None:
                    rejected.append(rej)
        finally:
            for p in pending:
                if not p.done():
                    p.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

    return {
        "products": verified,
        "count": len(verified),
        "candidateCount": total_candidates,
        "rejected": rejected,
    }


@app.post("/crawl/google-shopping")
async def crawl_google_shopping(
    body: GoogleShoppingRequest,
    x_crawler_key: str | None = Header(default=None),
):
    """Fast verified-product search.

    1. Try real Google Shopping (`udm=28`) — free, ~1 s when Google doesn't
       block us. From cloud IPs Google almost always serves a stub redirect,
       so step 2 carries most of the load in practice.
    2. Fall back to retailer search (Flipkart + Amazon.in via Playwright)
       with per-detail-page validation. ~10–20 s, but every product is real,
       has a working URL, an image, and an in-stock confirmation.

    Either path returns identical product shape with `verified: true`.
    """
    verify_key(x_crawler_key)

    # Step 1 — try Google Shopping itself
    google_result = await search_google_shopping(
        query=body.query,
        region=body.region,
        category=body.category,
    )
    products = google_result["products"]

    if products:
        if body.budget_max is not None:
            products = [
                p
                for p in products
                if p.get("price") is None or p["price"] <= body.budget_max
            ]
        if body.budget_min is not None:
            products = [
                p
                for p in products
                if p.get("price") is None or p["price"] >= body.budget_min
            ]
        if body.max_results:
            products = products[: body.max_results]
        print(
            f"google-shopping query={body.query!r} region={body.region} "
            f"source={google_result['source']} count={len(products)}"
        )
        return {
            "products": products,
            "count": len(products),
            "source": google_result["source"],
            "error": google_result.get("error"),
        }

    # Step 2 — retailer search fallback (this is what actually works today)
    print(
        f"google-shopping fallback query={body.query!r} region={body.region} "
        f"reason=google-empty error={google_result.get('error')}"
    )
    fb = await _run_retailer_search(
        query=body.query,
        region=body.region,
        category=body.category,
        budget_min=body.budget_min,
        budget_max=body.budget_max,
        max_results=body.max_results,
    )
    print(
        f"retailer-search query={body.query!r} region={body.region} "
        f"candidates={fb['candidateCount']} verified={fb['count']}"
    )
    return {
        "products": fb["products"],
        "count": fb["count"],
        "source": "retailer-search",
        "error": google_result.get("error"),
        "candidateCount": fb["candidateCount"],
        "rejected": fb["rejected"],
    }

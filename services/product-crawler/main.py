"""Aurafit product crawler — Playwright + multi-retailer search."""
from __future__ import annotations

import asyncio
import os
import time

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from config.retailers import (
    CORE_MARKETPLACE_DOMAINS,
    RetailerConfig,
    search_urls_for_region,
    search_wave,
)
from engines.crawl4ai_engine import extract_products
from engines.google_shopping_engine import search_google_shopping
from engines.playwright_engine import fetch_rendered_html, fetch_via_httpx
from extractors.google_shopping import rewrite_google_card
from validators import validate_product_url
from validators.ssrf import UnsafeUrlError, assert_safe_crawl_url

API_KEY = os.environ.get("CRAWLER_API_KEY", "").strip()

if not API_KEY:
    import sys

    print(
        "[crawler] FATAL: CRAWLER_API_KEY environment variable is not set or is empty. "
        "Set a strong random key before starting the crawler.",
        file=sys.stderr,
    )
    sys.exit(1)

MAX_CANDIDATES_PER_QUERY = int(os.environ.get("MAX_CANDIDATES_PER_QUERY", "8"))
MAX_VERIFIED_PER_QUERY = int(os.environ.get("MAX_VERIFIED_PER_QUERY", "16"))
MAX_CONCURRENT_VALIDATIONS = int(os.environ.get("MAX_CONCURRENT_VALIDATIONS", "2"))
# Each Playwright store search opens a browser context.
MAX_PARALLEL_STORE_SEARCHES = int(os.environ.get("MAX_PARALLEL_STORE_SEARCHES", "6"))
# Global cap: at most 3 full searches run concurrently when dynamic sites are enabled.
MAX_CONCURRENT_SEARCHES = int(os.environ.get("MAX_CONCURRENT_SEARCHES", "3"))
# Per-store wall clock — marketplace JS pages need more than 8s.
STORE_SEARCH_TIMEOUT_SEC = float(os.environ.get("STORE_SEARCH_TIMEOUT_SEC", "18"))
# One easy Shopify store must not fill the whole result set.
MAX_VERIFIED_PER_STORE = int(os.environ.get("MAX_VERIFIED_PER_STORE", "2"))
MIN_DISTINCT_RETAILERS = int(os.environ.get("MIN_DISTINCT_RETAILERS", "6"))

MAX_REQUEST_BODY_BYTES = 1 * 1024 * 1024

app = FastAPI(title="Aurafit Product Crawler", version="2.3.0")

# Initialised in lifespan; used by both /crawl/search and /crawl/google-shopping.
_search_sem: asyncio.Semaphore | None = None


@app.on_event("startup")
async def _startup() -> None:
    global _search_sem
    _search_sem = asyncio.Semaphore(MAX_CONCURRENT_SEARCHES)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large"},
        )
    return await call_next(request)


def verify_key(x_crawler_key: str | None = Header(default=None)) -> None:
    if not x_crawler_key or x_crawler_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing crawler key")


class SearchRequest(BaseModel):
    query: str
    region: str = "IN"
    category: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    max_results: int | None = None
    sites: list[dict] | None = None


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
    sites: list[dict] | None = None
    # Return Google cards immediately; skip Playwright retailer sweep.
    fast: bool = True


@app.get("/health")
async def health():
    return {"status": "ok", "service": "product-crawler", "version": "2.2.0"}


def _within_budget(
    price: float | None,
    budget_min: float | None,
    budget_max: float | None,
) -> bool:
    if budget_max is not None and price is not None and price > budget_max:
        return False
    if budget_min is not None and price is not None and price < budget_min:
        return False
    return True


def _simplify_query(query: str) -> str | None:
    """Drop color adjectives; keep garment nouns for sparse-query retry."""
    stop = {
        "blue", "red", "green", "black", "white", "pink", "yellow", "orange",
        "purple", "brown", "grey", "gray", "beige", "navy", "maroon", "cream",
        "linen", "cotton", "silk", "wool", "denim", "floral", "printed",
        "women", "womens", "men", "mens", "ladies", "girls", "buy", "online",
    }
    words = [w for w in query.lower().split() if w not in stop and len(w) > 2]
    simplified = " ".join(words[:6]).strip()
    if simplified and simplified != query.lower().strip():
        return simplified
    return None


async def _fetch_search_page(retailer: RetailerConfig, search_url: str) -> str:
    engine = (retailer.engine or "").lower()
    if engine in {"httpx", "shopify"} or "/search.json" in search_url:
        return await fetch_via_httpx(search_url)
    return await fetch_rendered_html(search_url, scroll=True, allow_unlockers=False)


async def _crawl_one_store(
    retailer: RetailerConfig,
    search_url: str,
    query: str,
    category: str | None,
    candidates_per_store: int,
) -> tuple[str, list[dict], str | None]:
    """Return (retailer_key, candidates, error)."""
    t0 = time.monotonic()
    try:
        html = await asyncio.wait_for(
            _fetch_search_page(retailer, search_url),
            timeout=STORE_SEARCH_TIMEOUT_SEC,
        )
        raw_items = await extract_products(search_url, query, html=html)
        for item in raw_items:
            item.setdefault("category", category)
            item.setdefault("retailer", retailer.key)
        elapsed = time.monotonic() - t0
        print(
            f"store-search {retailer.key} candidates={len(raw_items)} "
            f"elapsed={elapsed:.1f}s url={search_url[:80]}"
        )
        return retailer.key, raw_items[:candidates_per_store], None
    except Exception as e:  # noqa: BLE001
        elapsed = time.monotonic() - t0
        print(f"store-search {retailer.key} error={e} elapsed={elapsed:.1f}s")
        return retailer.key, [], str(e)


def _interleave_by_retailer(items: list[dict]) -> list[dict]:
    buckets: dict[str, list[dict]] = {}
    order: list[str] = []
    for item in items:
        key = str(item.get("retailer") or "unknown")
        if key not in buckets:
            buckets[key] = []
            order.append(key)
        buckets[key].append(item)
    out: list[dict] = []
    added = True
    while added:
        added = False
        for key in order:
            if buckets[key]:
                out.append(buckets[key].pop(0))
                added = True
    return out


def _product_url(product: dict) -> str:
    return str(product.get("url") or product.get("canonicalUrl") or "").strip()


def _merge_verified(left: list[dict], right: list[dict]) -> list[dict]:
    seen: set[str] = set()
    merged: list[dict] = []
    for product in _interleave_by_retailer(left + right):
        url = _product_url(product)
        if not url or url in seen:
            continue
        seen.add(url)
        merged.append(product)
    return merged


def _distinct_retailers(products: list[dict]) -> set[str]:
    out: set[str] = set()
    for product in products:
        key = str(product.get("retailer") or "").strip()
        if key:
            out.add(key)
            continue
        url = _product_url(product)
        if url:
            try:
                from urllib.parse import urlparse

                host = (urlparse(url).hostname or "").replace("www.", "").lower()
                if host:
                    out.add(host)
            except Exception:  # noqa: BLE001
                continue
    return out


def _core_marketplace_hosts(products: list[dict]) -> set[str]:
    hosts: set[str] = set()
    for product in products:
        url = _product_url(product)
        if not url:
            continue
        try:
            from urllib.parse import urlparse

            host = (urlparse(url).hostname or "").replace("www.", "").lower()
        except Exception:  # noqa: BLE001
            continue
        if any(host == d or host.endswith(f".{d}") for d in CORE_MARKETPLACE_DOMAINS):
            hosts.add(host)
    return hosts


def _google_card_trusted(card: dict) -> bool:
    """Google Shopping cards already carry a merchant URL + thumbnail."""
    if not card.get("title") or not card.get("url") or not card.get("image"):
        return False
    if card.get("verified") is False:
        return False
    return True


async def _run_retailer_search(
    query: str,
    region: str,
    category: str | None,
    budget_min: float | None,
    budget_max: float | None,
    max_results: int | None,
    site_overrides: list[dict] | None = None,
) -> dict:
    """Search marketplaces first, cap each store, then fill from brand sites."""
    max_verified = max_results or MAX_VERIFIED_PER_QUERY
    t0 = time.monotonic()

    verified: list[dict] = []
    rejected: list[dict] = []
    store_stats: dict[str, dict] = {}
    seen_urls: set[str] = set()
    seen_verified_titles: set[str] = set()
    per_store_verified: dict[str, int] = {}
    candidates_per_store = max(MAX_VERIFIED_PER_STORE + 2, 4)
    validation_sem = asyncio.Semaphore(MAX_CONCURRENT_VALIDATIONS)

    async def _resolve(cand: dict) -> tuple[dict | None, dict | None, str | None]:
        url = cand.get("url") or ""
        retailer_key = cand.get("retailer")
        async with validation_sem:
            product, reason = await validate_product_url(url)
        if product is None:
            return None, {"url": url, "reason": reason or "unknown"}, retailer_key
        if category and not product.get("category"):
            product["category"] = category
        product.setdefault("matchCategory", category)
        if retailer_key:
            product["retailer"] = retailer_key
        return product, None, retailer_key

    def _has_enough() -> bool:
        if len(verified) < max_verified:
            return False
        if len(_core_marketplace_hosts(verified)) < 2:
            return False
        return len(_distinct_retailers(verified)) >= MIN_DISTINCT_RETAILERS

    async def _search_and_validate(search_query: str) -> bool:
        nonlocal verified
        targets = search_urls_for_region(search_query, region, site_overrides)
        if not targets:
            return False

        waves: dict[int, list[tuple[RetailerConfig, str]]] = {0: [], 1: [], 2: []}
        for retailer, search_url in targets:
            waves.setdefault(search_wave(retailer), []).append((retailer, search_url))

        search_sem = asyncio.Semaphore(MAX_PARALLEL_STORE_SEARCHES)

        async def _bounded_crawl(retailer: RetailerConfig, url: str):
            try:
                assert_safe_crawl_url(url)
            except UnsafeUrlError:
                return retailer.key, [], "unsafe-url"
            async with search_sem:
                return await _crawl_one_store(
                    retailer, url, search_query, category, candidates_per_store
                )

        for wave in sorted(waves.keys()):
            if _has_enough():
                break

            wave_targets = waves[wave]
            if not wave_targets:
                continue

            store_results = await asyncio.gather(
                *[_bounded_crawl(r, u) for r, u in wave_targets],
                return_exceptions=True,
            )

            all_candidates: list[dict] = []
            for result in store_results:
                if isinstance(result, Exception):
                    continue
                key, items, err = result
                store_stats.setdefault(
                    key, {"candidates": 0, "verified": 0, "error": err}
                )
                store_stats[key]["candidates"] += len(items)
                for item in items:
                    u = item.get("url") or ""
                    if not u or u in seen_urls:
                        continue
                    seen_urls.add(u)
                    all_candidates.append(item)

            if not all_candidates:
                continue

            pending = [
                asyncio.create_task(_resolve(c))
                for c in _interleave_by_retailer(all_candidates)
            ]
            try:
                for fut in asyncio.as_completed(pending):
                    if _has_enough():
                        break
                    try:
                        product, rej, retailer_key = await fut
                    except Exception as e:  # noqa: BLE001
                        rejected.append({"url": "", "reason": f"resolve error: {e}"})
                        continue
                    if product is not None and _within_budget(
                        product.get("price"), budget_min, budget_max
                    ):
                        rk = str(retailer_key or product.get("retailer") or "unknown")
                        if per_store_verified.get(rk, 0) >= MAX_VERIFIED_PER_STORE:
                            continue
                        title_key = str(product.get("title") or "").lower().strip()[:80]
                        if title_key and title_key in seen_verified_titles:
                            continue
                        if title_key:
                            seen_verified_titles.add(title_key)
                        verified.append(product)
                        per_store_verified[rk] = per_store_verified.get(rk, 0) + 1
                        if rk in store_stats:
                            store_stats[rk]["verified"] += 1
                    elif rej is not None:
                        rejected.append(rej)
            finally:
                for p in pending:
                    if not p.done():
                        p.cancel()
                await asyncio.gather(*pending, return_exceptions=True)

            print(
                f"retailer-search wave={wave} query={search_query!r} "
                f"verified={len(verified)} stores={store_stats}"
            )

        return len(verified) > 0

    await _search_and_validate(query)
    if len(verified) == 0:
        alt = _simplify_query(query)
        if alt:
            await _search_and_validate(alt)

    elapsed = time.monotonic() - t0
    print(
        f"retailer-search total elapsed={elapsed:.1f}s verified={len(verified)} "
        f"retailers={sorted(_distinct_retailers(verified))}"
    )

    return {
        "products": verified[:max_verified],
        "count": min(len(verified), max_verified),
        "candidateCount": len(seen_urls),
        "rejected": rejected,
        "storeStats": store_stats,
    }


async def _resolve_google_products(
    products: list[dict],
    category: str | None,
    budget_min: float | None,
    budget_max: float | None,
    max_results: int | None,
) -> list[dict]:
    """Validate Google Shopping merchant URLs on real PDPs."""
    cap = max_results or MAX_VERIFIED_PER_QUERY
    candidates = products[: max(cap + 2, 6)]
    validation_sem = asyncio.Semaphore(MAX_CONCURRENT_VALIDATIONS)
    verified: list[dict] = []

    async def _one(card: dict) -> dict | None:
        url = card.get("url") or ""
        if not url:
            return None
        async with validation_sem:
            product, reason = await validate_product_url(url)
        if product is None:
            print(f"google-resolve rejected {url[:80]} reason={reason}")
            return None
        if category and not product.get("category"):
            product["category"] = category
        product.setdefault("matchCategory", category)
        if not _within_budget(product.get("price"), budget_min, budget_max):
            return None
        # Prefer PDP image/title over Google card
        if card.get("image") and not product.get("image"):
            product["image"] = card["image"]
        return product

    results = await asyncio.gather(*[_one(c) for c in candidates], return_exceptions=True)
    for r in results:
        if isinstance(r, dict) and r.get("verified"):
            verified.append(r)
        if len(verified) >= cap:
            break
    return verified


@app.post("/crawl/search")
async def crawl_search(
    body: SearchRequest,
    x_crawler_key: str | None = Header(default=None),
):
    verify_key(x_crawler_key)
    async with _search_sem:
        fb = await _run_retailer_search(
            query=body.query,
            region=body.region,
            category=body.category,
            budget_min=body.budget_min,
            budget_max=body.budget_max,
            max_results=body.max_results,
            site_overrides=body.sites,
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
    verify_key(x_crawler_key)
    try:
        safe_url = assert_safe_crawl_url(body.url)
    except UnsafeUrlError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    html = await fetch_rendered_html(safe_url)
    products = await extract_products(safe_url, body.query, html=html)
    return {"products": products, "count": len(products)}


@app.post("/crawl/resolve")
async def crawl_resolve(
    body: ResolveRequest,
    x_crawler_key: str | None = Header(default=None),
):
    verify_key(x_crawler_key)
    try:
        safe_url = assert_safe_crawl_url(body.url)
    except UnsafeUrlError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    product, reason = await validate_product_url(safe_url)
    if product is None:
        return {"verified": False, "reason": reason, "product": None}
    return {"verified": True, "reason": None, "product": product}


@app.post("/crawl/google-shopping")
async def crawl_google_shopping(
    body: GoogleShoppingRequest,
    x_crawler_key: str | None = Header(default=None),
):
    verify_key(x_crawler_key)

    async with _search_sem:
        google_result = await search_google_shopping(
            query=body.query,
            region=body.region,
            category=body.category,
        )
        products = google_result["products"]

        # Trust merchant cards as-is. Playwright PDP checks from cloud IPs
        # reject Amazon / Myntra / Ajio even when the listing is live.
        # Snitch cards that aren't live /<category>/<handle>/<id>/buy PDPs are
        # dropped — old snitch.co.in handles cannot be mapped to the new site.
        verified: list[dict] = []
        for p in products:
            if not _google_card_trusted(p):
                continue
            rewritten = rewrite_google_card(p)
            if rewritten:
                verified.append(rewritten)
        if verified:
            print(
                f"google-shopping query={body.query!r} region={body.region} "
                f"source={google_result['source']} trusted={len(verified)} "
                f"retailers={sorted(_distinct_retailers(verified))} "
                f"core={sorted(_core_marketplace_hosts(verified))}"
            )
            cap = body.max_results or MAX_VERIFIED_PER_QUERY
            # Fast path (generation): Google cards are the internet-wide search.
            # A Playwright sweep of 20 stores is what blew past 5 minutes.
            if body.fast or len(_core_marketplace_hosts(verified)) >= 2:
                return {
                    "products": verified[:cap],
                    "count": min(len(verified), cap),
                    "source": f"{google_result['source']}-trusted",
                    "error": google_result.get("error"),
                }
            print(
                f"google-shopping query={body.query!r} missing core marketplaces "
                f"— merging retailer search"
            )
        elif products:
            print(
                f"google-shopping query={body.query!r} cards={len(products)} "
                f"trusted=0 — falling back to retailer search"
            )

        if body.fast:
            cap = body.max_results or MAX_VERIFIED_PER_QUERY
            return {
                "products": verified[:cap],
                "count": min(len(verified), cap),
                "source": f"{google_result.get('source', 'google')}-fast",
                "error": google_result.get("error"),
            }

        print(
            f"google-shopping fallback query={body.query!r} region={body.region} "
            f"reason=google-empty-or-unresolved error={google_result.get('error')}"
        )
        fb = await _run_retailer_search(
            query=body.query,
            region=body.region,
            category=body.category,
            budget_min=body.budget_min,
            budget_max=body.budget_max,
            max_results=body.max_results,
            site_overrides=body.sites,
        )

    merged = _merge_verified(verified, fb["products"]) if verified else fb["products"]
    cap = body.max_results or MAX_VERIFIED_PER_QUERY
    merged = merged[:cap]

    return {
        "products": merged,
        "count": len(merged),
        "source": "retailer-search" if not verified else "google+retailer",
        "error": google_result.get("error"),
        "candidateCount": fb["candidateCount"],
        "rejected": fb["rejected"],
        "storeStats": fb.get("storeStats"),
    }

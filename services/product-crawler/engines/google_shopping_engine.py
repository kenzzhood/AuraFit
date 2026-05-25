"""Self-hosted Google Shopping engine.

Performance strategy:
  1. Fast path: plain HTTP (`httpx`) with realistic browser headers. Most
     Google Shopping pages are server-rendered, so this returns 300–800 ms and
     yields all the product cards we need.
  2. Fallback: shared Playwright browser (one process, new context per call)
     when the fast path returns 0 cards — usually because Google served a
     consent / CAPTCHA interstitial. We never spawn a new browser per call;
     that was the root cause of the previous timeout pile-up.

Returns the same dict shape as `extractors.google_shopping.parse_google_shopping_html`.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

from extractors.google_shopping import (
    build_search_url,
    fallback_parse_json_blobs,
    parse_google_shopping_html,
)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
    # IMPORTANT: do not advertise `br` unless we link the brotli decoder into
    # httpx. Google will happily send brotli-compressed bytes that httpx then
    # surfaces as garbage. gzip + deflate are decoded transparently.
    "Accept-Encoding": "gzip, deflate",
    "Sec-Ch-Ua": '"Chromium";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

_HTTPX_TIMEOUT = float(os.environ.get("GOOGLE_SHOPPING_HTTP_TIMEOUT", "10"))
_PLAYWRIGHT_FALLBACK = (
    os.environ.get("GOOGLE_SHOPPING_PLAYWRIGHT_FALLBACK", "true").lower() == "true"
)

# Shared Playwright resources — created lazily on the first fallback call and
# kept warm for the lifetime of the worker process.
_pw_lock = asyncio.Lock()
_pw_browser = None  # type: ignore[var-annotated]
_pw_playwright = None  # type: ignore[var-annotated]


async def _fetch_via_httpx(url: str) -> str:
    async with httpx.AsyncClient(
        headers=DEFAULT_HEADERS,
        timeout=_HTTPX_TIMEOUT,
        follow_redirects=True,
        http2=True,
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


async def _get_pw_browser():
    global _pw_browser, _pw_playwright
    if _pw_browser is not None:
        return _pw_browser
    async with _pw_lock:
        if _pw_browser is not None:
            return _pw_browser
        from playwright.async_api import async_playwright

        _pw_playwright = await async_playwright().start()
        _pw_browser = await _pw_playwright.chromium.launch(headless=True)
        return _pw_browser


async def _fetch_via_playwright(url: str) -> str:
    browser = await _get_pw_browser()
    context = await browser.new_context(user_agent=DEFAULT_HEADERS["User-Agent"])
    try:
        page = await context.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        # Give lazy-loaded thumbnails a chance to swap in.
        try:
            await page.wait_for_selector(
                "div.sh-dgr__content, div.KZmu8e, div.tu5SU, div.i0X6df, "
                "div.Cluv0, div.uYNZm, div.sh-pr__product-result",
                timeout=4_000,
            )
        except Exception:
            pass
        return await page.content()
    finally:
        await context.close()


async def search_google_shopping(
    query: str,
    region: str = "IN",
    category: str | None = None,
) -> dict[str, Any]:
    """Return ``{'products': [...], 'source': 'httpx'|'playwright'|'empty', 'count': N}``."""
    url = build_search_url(query, region)

    # Fast path: httpx
    html = ""
    err: str | None = None
    try:
        html = await _fetch_via_httpx(url)
    except Exception as e:  # noqa: BLE001 — log, fall through to playwright
        err = f"httpx: {e}"

    products = parse_google_shopping_html(html, region, category)
    if not products and html:
        products = fallback_parse_json_blobs(html)

    if products or not _PLAYWRIGHT_FALLBACK:
        return {
            "products": products,
            "source": "httpx" if products else "empty",
            "count": len(products),
            "query": query,
            "region": region,
            "error": err,
        }

    # Fallback: shared Playwright browser
    try:
        html2 = await _fetch_via_playwright(url)
    except Exception as e:  # noqa: BLE001
        return {
            "products": [],
            "source": "playwright-error",
            "count": 0,
            "query": query,
            "region": region,
            "error": f"playwright: {e}",
        }

    products = parse_google_shopping_html(html2, region, category)
    return {
        "products": products,
        "source": "playwright" if products else "empty",
        "count": len(products),
        "query": query,
        "region": region,
        "error": err,
    }

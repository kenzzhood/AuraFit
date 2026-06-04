"""Playwright engine for JS-rendered ecommerce pages.

Uses a shared Chromium instance per worker process (new browser context per
fetch) to avoid the 20–45 s penalty of launching a fresh browser per page.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}

# Retailers that fail with Playwright HTTP/2 — fetch via httpx HTTP/1.1 instead.
_HTTP_FETCH_HOSTS = {"myntra.com", "www.myntra.com", "ajio.com", "www.ajio.com"}

# Playwright launch args for problematic hosts.
_HTTP2_DISABLE_HOSTS = {"myntra.com", "www.myntra.com", "ajio.com", "www.ajio.com"}

_pw_lock = asyncio.Lock()
_pw_browser = None  # type: ignore[var-annotated]
_pw_playwright = None  # type: ignore[var-annotated]


def _host_of(url: str) -> str:
    from urllib.parse import urlparse

    return (urlparse(url).netloc or "").lower()


def _needs_httpx_fetch(url: str) -> bool:
    host = _host_of(url)
    return any(h in host for h in _HTTP_FETCH_HOSTS)


def _needs_http2_disable(url: str) -> bool:
    host = _host_of(url)
    return any(h in host for h in _HTTP2_DISABLE_HOSTS)


async def _get_pw_browser(*, disable_http2: bool = False):
    global _pw_browser, _pw_playwright
    if _pw_browser is not None and not disable_http2:
        return _pw_browser
    async with _pw_lock:
        if _pw_browser is not None and not disable_http2:
            return _pw_browser
        from playwright.async_api import async_playwright

        if _pw_playwright is None:
            _pw_playwright = await async_playwright().start()
        args = ["--disable-http2"] if disable_http2 else []
        if _pw_browser is None:
            _pw_browser = await _pw_playwright.chromium.launch(
                headless=True,
                args=args if args else None,
            )
        return _pw_browser


async def fetch_via_httpx(url: str, *, mobile: bool = False) -> str:
    """Fast HTTP/1.1 fetch for search pages that break Playwright HTTP/2."""
    headers = {**DEFAULT_HEADERS}
    if mobile:
        headers["User-Agent"] = MOBILE_USER_AGENT
    timeout = float(os.environ.get("SEARCH_HTTP_TIMEOUT", "15"))
    async with httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        http2=False,
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text


async def fetch_rendered_html(
    url: str,
    scroll: bool = True,
    *,
    mobile: bool = False,
) -> str:
    """Fetch rendered HTML via shared Playwright browser or httpx fallback."""
    if _needs_httpx_fetch(url):
        try:
            return await fetch_via_httpx(url, mobile=mobile)
        except Exception:
            if not mobile:
                return await fetch_via_httpx(url, mobile=True)
            raise

    disable_http2 = _needs_http2_disable(url)
    browser = await _get_pw_browser(disable_http2=disable_http2)
    ua = MOBILE_USER_AGENT if mobile else DEFAULT_USER_AGENT
    goto_timeout = int(os.environ.get("PLAYWRIGHT_GOTO_TIMEOUT_MS", "12000"))
    context = await browser.new_context(user_agent=ua)
    try:
        page = await context.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=goto_timeout)
        if scroll:
            for _ in range(2):
                try:
                    await page.evaluate("window.scrollBy(0, window.innerHeight)")
                    await asyncio.sleep(0.5)
                except Exception:
                    # Flipkart and others navigate client-side mid-scroll.
                    break
        return await page.content()
    finally:
        await context.close()


async def screenshot_page(url: str) -> bytes | None:
    browser = await _get_pw_browser()
    context = await browser.new_context(user_agent=DEFAULT_USER_AGENT)
    try:
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=45_000)
            return await page.screenshot(full_page=False)
        except Exception:
            return None
    finally:
        await context.close()

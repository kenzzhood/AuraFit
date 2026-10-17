"""HTML fetch ladder (Scrapling) plus Playwright screenshots.

`fetch_rendered_html` uses Scrapling HTTP impersonate → StealthyFetcher →
optional Bright Data / Oxylabs. Vanilla Playwright is used only by
`screenshot_page`.
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

# Plain HTTP only for JSON APIs. Myntra / Ajio search pages are JS-rendered
# and must go through Playwright (with HTTP/2 disabled).
_HTTP_FETCH_HOSTS: set[str] = set()

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


def _wait_selector_for(url: str) -> str | None:
    """Give JS-heavy marketplaces time to paint product cards."""
    host = _host_of(url)
    if "amazon." in host:
        return '[data-component-type="s-search-result"], div[data-asin]'
    if "myntra.com" in host:
        return "li.product-base, ul.results-base"
    if "ajio.com" in host:
        return "div.itemrilrtl-products-list, a[href*='/p/']"
    if "flipkart.com" in host:
        return "a[href*='/p/itm'], [data-id]"
    if "nykaa" in host:
        return "a[href*='/p/'], a[href*='/product/']"
    return None


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
        # Always disable HTTP/2 — Myntra/Ajio fail on it, Amazon/Flipkart do not need it.
        if _pw_browser is None:
            _pw_browser = await _pw_playwright.chromium.launch(
                headless=True,
                args=["--disable-http2"],
            )
        return _pw_browser


async def fetch_via_httpx(url: str, *, mobile: bool = False) -> str:
    """Fast HTTP/1.1 fetch for search pages that break Playwright HTTP/2."""
    headers = {**DEFAULT_HEADERS}
    if mobile:
        headers["User-Agent"] = MOBILE_USER_AGENT
    timeout = float(os.environ.get("SEARCH_HTTP_TIMEOUT", "15"))
    from urllib.parse import urljoin

    from validators.ssrf import UnsafeUrlError, assert_safe_crawl_url

    async with httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=False,
        http2=False,
    ) as client:
        current = assert_safe_crawl_url(url)
        for _ in range(3):
            r = await client.get(current)
            if r.status_code in (301, 302, 303, 307, 308):
                loc = r.headers.get("location")
                if not loc:
                    raise UnsafeUrlError("redirect without Location")
                current = assert_safe_crawl_url(urljoin(current, loc))
                continue
            r.raise_for_status()
            return r.text
        raise UnsafeUrlError("too many redirects")


def _html_and_status(page: Any) -> tuple[str, int | None]:
    if page is None:
        return "", None
    status_raw = getattr(page, "status", None)
    try:
        status = int(status_raw) if status_raw is not None else None
    except (TypeError, ValueError):
        status = None
    body = getattr(page, "body", None)
    if isinstance(body, bytes):
        enc = getattr(page, "encoding", None) or "utf-8"
        try:
            return body.decode(enc, errors="replace"), status
        except LookupError:
            return body.decode("utf-8", errors="replace"), status
    if isinstance(body, str) and body:
        return body, status
    html_content = getattr(page, "html_content", None)
    if isinstance(html_content, str) and html_content:
        return html_content, status
    if html_content is not None:
        return str(html_content), status
    return str(page or ""), status


async def _fetch_via_scrapling_http(url: str) -> tuple[str, int | None]:
    from scrapling.fetchers import AsyncFetcher

    timeout = float(os.environ.get("FETCH_HTTP_TIMEOUT_SEC", "8"))
    impersonate = os.environ.get("SCRAPLING_IMPERSONATE", "chrome")
    page = await AsyncFetcher.get(
        url,
        impersonate=impersonate,
        stealthy_headers=True,
        timeout=timeout,
    )
    return _html_and_status(page)


async def _fetch_via_stealthy(url: str) -> tuple[str, int | None]:
    from scrapling.fetchers import StealthyFetcher

    timeout_ms = int(os.environ.get("FETCH_STEALTH_TIMEOUT_MS", "15000"))
    kwargs: dict[str, Any] = {
        "headless": True,
        "solve_cloudflare": True,
        "timeout": timeout_ms,
    }
    wait_sel = _wait_selector_for(url)
    if wait_sel:
        kwargs["wait_selector"] = wait_sel
    page = await StealthyFetcher.async_fetch(url, **kwargs)
    return _html_and_status(page)


async def fetch_rendered_html(
    url: str,
    scroll: bool = True,  # noqa: ARG001 — kept for callers; stealth wait_selector covers paint
    *,
    mobile: bool = False,  # noqa: ARG001 — kept for callers; impersonate handles UA
    allow_unlockers: bool = True,
) -> str:
    """Fetch HTML via Scrapling HTTP → StealthyFetcher → optional unlockers.

    Does not fall back to vanilla Playwright.
    """
    from engines.html_quality import html_usable
    from engines.unlockers import fetch_via_brightdata, fetch_via_oxylabs
    from validators.ssrf import UnsafeUrlError, assert_safe_crawl_url

    safe = assert_safe_crawl_url(url)
    html, status = "", None

    try:
        html, status = await _fetch_via_scrapling_http(safe)
    except UnsafeUrlError:
        raise
    except Exception:
        html, status = "", None
    if html_usable(html, status):
        return html

    try:
        html, status = await _fetch_via_stealthy(safe)
    except UnsafeUrlError:
        raise
    except Exception:
        html, status = "", None
    if html_usable(html, status):
        return html

    if not allow_unlockers:
        return html or ""

    try:
        html, status = await fetch_via_brightdata(safe)
    except UnsafeUrlError:
        raise
    except Exception:
        html, status = "", None
    if html_usable(html, status):
        return html

    try:
        html, status = await fetch_via_oxylabs(safe)
    except UnsafeUrlError:
        raise
    except Exception:
        html, status = "", None
    if html_usable(html, status):
        return html

    return html or ""


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

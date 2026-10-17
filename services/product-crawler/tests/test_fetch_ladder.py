"""Fetch ladder: Scrapling HTTP → stealth → Bright Data → Oxylabs."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from engines.html_quality import html_usable
from engines.playwright_engine import fetch_rendered_html
from validators.generic import validate_generic_product


def _ok_html() -> str:
    return (
        "<html><head><title>Slim Fit Oxford Shirt</title></head>"
        "<body>" + ("product listing " * 40) + "</body></html>"
    )


def _challenge_html() -> str:
    return "<html><body>Just a moment" + ("." * 400) + "</body></html>"


def _shopify_404() -> str:
    return (
        "<html><head><title>404 Not Found</title></head>"
        "<body>Sorry, this page does not exist." + (" " * 400) + "</body></html>"
    )


@pytest.fixture(autouse=True)
def _skip_dns_ssrf(monkeypatch):
    monkeypatch.setattr("validators.ssrf.assert_safe_crawl_url", lambda u: u)


@pytest.mark.asyncio
async def test_usable_http_stops_without_stealth_or_unlocker(monkeypatch):
    stealth = AsyncMock()
    bd = AsyncMock()
    ox = AsyncMock()
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_scrapling_http",
        AsyncMock(return_value=(_ok_html(), 200)),
    )
    monkeypatch.setattr("engines.playwright_engine._fetch_via_stealthy", stealth)
    monkeypatch.setattr("engines.unlockers.fetch_via_brightdata", bd)
    monkeypatch.setattr("engines.unlockers.fetch_via_oxylabs", ox)

    html = await fetch_rendered_html("https://example.com/p/1")
    assert "Slim Fit Oxford Shirt" in html
    stealth.assert_not_called()
    bd.assert_not_called()
    ox.assert_not_called()


@pytest.mark.asyncio
async def test_challenge_calls_stealth_once(monkeypatch):
    stealth = AsyncMock(return_value=(_ok_html(), 200))
    bd = AsyncMock()
    ox = AsyncMock()
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_scrapling_http",
        AsyncMock(return_value=(_challenge_html(), 200)),
    )
    monkeypatch.setattr("engines.playwright_engine._fetch_via_stealthy", stealth)
    monkeypatch.setattr("engines.unlockers.fetch_via_brightdata", bd)
    monkeypatch.setattr("engines.unlockers.fetch_via_oxylabs", ox)

    html = await fetch_rendered_html("https://www.amazon.in/s?k=shirt")
    assert "Slim Fit Oxford Shirt" in html
    assert stealth.await_count == 1
    bd.assert_not_called()
    ox.assert_not_called()


@pytest.mark.asyncio
async def test_stealth_blank_with_keys_tries_brightdata_then_oxylabs(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("OXYLABS_USERNAME", "user")
    monkeypatch.setenv("OXYLABS_PASSWORD", "pass")
    bd = AsyncMock(return_value=("", 200))
    ox = AsyncMock(return_value=(_ok_html(), 200))
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_scrapling_http",
        AsyncMock(return_value=(_challenge_html(), 403)),
    )
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_stealthy",
        AsyncMock(return_value=("", None)),
    )
    monkeypatch.setattr("engines.unlockers.fetch_via_brightdata", bd)
    monkeypatch.setattr("engines.unlockers.fetch_via_oxylabs", ox)

    html = await fetch_rendered_html("https://example.com/p/1")
    assert "Slim Fit Oxford Shirt" in html
    assert bd.await_count == 1
    assert ox.await_count == 1


@pytest.mark.asyncio
async def test_allow_unlockers_false_skips_brightdata_and_oxylabs(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_API_TOKEN", "test-token")
    monkeypatch.setenv("BRIGHTDATA_WEB_UNLOCKER_ZONE", "web_unlocker")
    monkeypatch.setenv("OXYLABS_USERNAME", "user")
    monkeypatch.setenv("OXYLABS_PASSWORD", "pass")
    bd = AsyncMock()
    ox = AsyncMock()
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_scrapling_http",
        AsyncMock(return_value=(_challenge_html(), 403)),
    )
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_stealthy",
        AsyncMock(return_value=("", None)),
    )
    monkeypatch.setattr("engines.unlockers.fetch_via_brightdata", bd)
    monkeypatch.setattr("engines.unlockers.fetch_via_oxylabs", ox)

    html = await fetch_rendered_html(
        "https://example.com/p/1", allow_unlockers=False
    )
    assert html == ""
    bd.assert_not_called()
    ox.assert_not_called()


@pytest.mark.asyncio
async def test_empty_keys_make_zero_unlocker_http(monkeypatch):
    monkeypatch.delenv("BRIGHTDATA_API_TOKEN", raising=False)
    monkeypatch.delenv("OXYLABS_USERNAME", raising=False)
    monkeypatch.delenv("OXYLABS_PASSWORD", raising=False)

    posts: list[str] = []

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            posts.append(url)
            raise AssertionError("unlocker HTTP must not run without keys")

    monkeypatch.setattr("engines.unlockers.httpx.AsyncClient", _FakeClient)
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_scrapling_http",
        AsyncMock(return_value=("", None)),
    )
    monkeypatch.setattr(
        "engines.playwright_engine._fetch_via_stealthy",
        AsyncMock(return_value=("", None)),
    )

    html = await fetch_rendered_html("https://example.com/p/1")
    assert html == ""
    assert posts == []


@pytest.mark.asyncio
async def test_404_html_not_verified(monkeypatch):
    html = _shopify_404()
    assert html_usable(html, 404) is False

    async def fake_fetch(url, scroll=True, **kwargs):
        return html

    monkeypatch.setattr("validators.generic.fetch_rendered_html", fake_fetch)
    product, reason = await validate_generic_product(
        "https://www.snitch.com/products/gone-shirt"
    )
    assert product is None
    assert reason is not None
    assert "404" in reason or "challenge" in reason


def test_html_and_status_from_scrapling_page():
    from engines.playwright_engine import _html_and_status

    page = SimpleNamespace(status=200, body=_ok_html().encode("utf-8"), encoding="utf-8")
    html, status = _html_and_status(page)
    assert status == 200
    assert "Slim Fit Oxford Shirt" in html

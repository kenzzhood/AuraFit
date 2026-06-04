"""Integration smoke test — requires network; skip unless CRAWLER_SMOKE=1."""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("CRAWLER_SMOKE") != "1",
    reason="Set CRAWLER_SMOKE=1 to run live crawler smoke tests",
)


@pytest.mark.asyncio
async def test_retailer_search_returns_verified_products():
    from main import _run_retailer_search

    result = await _run_retailer_search(
        query="women blue dress",
        region="IN",
        category="dress",
        budget_min=None,
        budget_max=None,
        max_results=3,
    )
    products = result["products"]
    assert result["count"] >= 1, f"expected verified products, got {result}"
    assert len(products) >= 1
    for p in products:
        assert p.get("verified") is True
        assert p.get("url")
        assert p.get("image")
        assert p.get("title")

"""Smoke tests for retailer registry and URL heuristics."""
from __future__ import annotations

from config.retailers import build_search_url, get_retailers, search_urls_for_region
from extractors.fashion_product import _is_real_product_url


def test_in_retailers_loaded():
    retailers = get_retailers()
    keys = {r.key for r in retailers}
    assert "flipkart" in keys
    assert "amazon_in" in keys
    assert "myntra" in keys
    assert "ajio" in keys
    assert "snitch" in keys
    assert "bananaclub" in keys
    assert "tatacliq" in keys
    assert "zara_in" in keys
    assert "hm_in" in keys
    assert "uniqlo_in" in keys
    assert "asos" in keys


def test_search_urls_for_in_region():
    targets = search_urls_for_region("blue dress women", "IN")
    assert len(targets) >= 10
    urls = [u for _, u in targets]
    assert any("flipkart.com" in u for u in urls)
    assert any("amazon.in" in u for u in urls)
    assert any("myntra.com" in u for u in urls)
    assert any("ajio.com" in u for u in urls)
    assert any("tatacliq.com" in u for u in urls)
    assert any("zara.com" in u for u in urls)
    assert any("asos.com" in u for u in urls)


def test_myntra_slug_query():
    myntra = next(r for r in get_retailers() if r.key == "myntra")
    url = build_search_url(myntra, "blue linen dress")
    assert "myntra.com" in url
    assert "blue-linen-dress" in url or "blue" in url


def test_product_url_heuristics():
    assert _is_real_product_url(
        "https://www.flipkart.com/foo/p/itm123", "flipkart.com"
    )
    assert _is_real_product_url(
        "https://www.amazon.in/dp/B012345678", "amazon.in"
    )
    assert _is_real_product_url(
        "https://www.myntra.com/dresses/123/456/buy", "myntra.com"
    )
    assert _is_real_product_url(
        "https://www.ajio.com/p/product-name", "ajio.com"
    )
    assert _is_real_product_url(
        "https://www.snitch.co.in/products/slim-fit-shirt", "snitch.co.in"
    )
    assert _is_real_product_url(
        "https://www.tatacliq.com/p-m1234567890123456789", "tatacliq.com"
    )
    assert _is_real_product_url(
        "https://www.zara.com/in/en/shirt-p12345678.html", "zara.com"
    )
    assert _is_real_product_url(
        "https://www.asos.com/asos-design/asos-design-shirt/prd/12345678", "asos.com"
    )
    assert not _is_real_product_url(
        "https://www.flipkart.com/search?q=dress", "flipkart.com"
    )

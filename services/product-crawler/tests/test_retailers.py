"""Smoke tests for retailer registry and URL heuristics."""
from __future__ import annotations

import json

import pytest

from config.retailers import build_search_url, get_retailers, search_urls_for_region
from extractors.fashion_product import (
    _is_real_product_url,
    parse_products_from_html,
    parse_products_from_response,
    parse_products_from_shopify_json,
)
from validators import is_usable_snitch_product_url, rewrite_legacy_retailer_url


def test_in_retailers_loaded():
    retailers = get_retailers()
    keys = {r.key for r in retailers}
    assert "flipkart" in keys
    assert "amazon_in" in keys
    assert "myntra" in keys
    assert "ajio" in keys
    assert "meesho" in keys
    assert "snitch" in keys
    assert "bananaclub" in keys
    assert "tatacliq" in keys
    assert "zara_in" in keys
    assert "hm_in" in keys
    assert "uniqlo_in" in keys
    assert "asos" in keys


def test_search_urls_for_in_region():
    targets = search_urls_for_region("blue dress women", "IN")
    assert len(targets) >= 12
    urls = [u for _, u in targets]
    assert any("flipkart.com" in u for u in urls)
    assert any("amazon.in" in u for u in urls)
    assert any("myntra.com" in u for u in urls)
    assert any("ajio.com" in u for u in urls)
    assert any("tatacliq.com" in u for u in urls)
    assert any("zara.com" in u for u in urls)
    assert any("asos.com" in u for u in urls)
    assert any("meesho.com" in u for u in urls)


def test_marketplaces_searched_before_boutique():
    targets = search_urls_for_region("blue dress women", "IN")
    domains = []
    for retailer, url in targets:
        host = url.split("/")[2].replace("www.", "").lower()
        domains.append(host)
    first = domains[:5]
    assert any("amazon.in" in d for d in first)
    assert any("myntra.com" in d for d in first)
    assert any("ajio.com" in d for d in first)
    banana_idx = next(
        (i for i, d in enumerate(domains) if "bananaclub" in d), None
    )
    amazon_idx = next(i for i, d in enumerate(domains) if "amazon.in" in d)
    assert banana_idx is None or banana_idx > amazon_idx
    assert banana_idx is None or banana_idx >= 8


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
        "https://www.myntra.com/dresses/aayu/aayu-women-floral-printed/12345678",
        "myntra.com",
    )
    assert _is_real_product_url(
        "https://www.ajio.com/p/product-name", "ajio.com"
    )
    assert _is_real_product_url(
        "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy",
        "snitch.com",
    )
    assert not _is_real_product_url(
        "https://www.snitch.co.in/products/slim-fit-shirt", "snitch.co.in"
    )
    assert not _is_real_product_url(
        "https://www.snitch.com/products/slim-fit-shirt", "snitch.com"
    )
    assert not _is_real_product_url(
        "https://www.snitch.com/men-accessories/buy", "snitch.com"
    )
    assert not _is_real_product_url(
        "https://www.snitch.com/products", "snitch.com"
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


def test_snitch_search_is_html_on_snitch_com():
    snitch = next(r for r in get_retailers() if r.key == "snitch")
    url = build_search_url(snitch, "blue shirt")
    assert "snitch.com" in url
    assert "/search?" in url
    assert "search.json" not in url
    assert snitch.engine == "playwright"
    banana = next(r for r in get_retailers() if r.key == "bananaclub")
    banana_url = build_search_url(banana, "blue shirt")
    assert "search.json" in banana_url
    assert banana.engine == "httpx"


def test_parse_snitch_search_html_new_pdp_shape():
    html = """
    <html><body>
    <a href="/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy">Regular Fit Black Shirt</a>
    <a href="https://www.snitch.com/men-tshirts/oversized-tee-4msst123-01/9269896904999/buy">Oversized Tee</a>
    <a href="/men-accessories/buy">Men Accessories</a>
    <a href="/products/floral-midi-dress">Floral Midi Dress</a>
    <a href="https://www.snitch.co.in/">We moved</a>
    </body></html>
    """
    products = parse_products_from_html(html, "https://www.snitch.com/search?q=shirt")
    urls = [p["url"] for p in products]
    assert (
        "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy"
        in urls
    )
    assert (
        "https://www.snitch.com/men-tshirts/oversized-tee-4msst123-01/9269896904999/buy"
        in urls
    )
    assert not any("/men-accessories/buy" in u for u in urls)
    assert not any("/products" in u for u in urls)
    assert not any("snitch.co.in" in u for u in urls)


def test_rewrite_legacy_retailer_url_and_usable_pdp():
    assert (
        rewrite_legacy_retailer_url(
            "https://www.snitch.co.in/products/slim-fit-shirt?color=navy"
        )
        == "https://www.snitch.com/products/slim-fit-shirt?color=navy"
    )
    assert is_usable_snitch_product_url(
        "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy"
    )
    # Shopify-era /products/ handles are dead on snitch.com, and old
    # snitch.co.in URLs cannot be mapped to the new site at all.
    assert not is_usable_snitch_product_url(
        "https://www.snitch.co.in/products/slim-fit-shirt"
    )
    assert not is_usable_snitch_product_url(
        "https://www.snitch.com/products/slim-fit-shirt"
    )
    assert not is_usable_snitch_product_url("https://www.snitch.co.in/")
    assert not is_usable_snitch_product_url("https://www.snitch.com/products")
    assert not is_usable_snitch_product_url(
        "https://www.snitch.com/men-accessories/buy"
    )


def test_parse_shopify_search_json_for_bananaclub():
    # snitch.com is no longer Shopify — Banana Club still serves search.json.
    payload = json.dumps(
        {
            "results": [
                {
                    "title": "Slim Fit Shirt",
                    "url": "/products/slim-fit-shirt",
                    "handle": "slim-fit-shirt",
                    "featured_image": "https://cdn.shopify.com/s/files/1/shirt.jpg",
                    "price": "199900",
                }
            ]
        }
    )
    base = "https://www.bananaclub.co.in/search.json?q=shirt&type=product"
    products = parse_products_from_shopify_json(payload, base)
    assert len(products) == 1
    assert products[0]["title"] == "Slim Fit Shirt"
    assert (
        products[0]["url"] == "https://www.bananaclub.co.in/products/slim-fit-shirt"
    )
    via_response = parse_products_from_response(payload, base)
    assert via_response[0]["url"] == products[0]["url"]


@pytest.mark.asyncio
async def test_validate_rewrites_snitch_co_in(monkeypatch):
    captured: dict[str, str] = {}

    async def fake_generic(url: str):
        captured["url"] = url
        return None, "skip"

    monkeypatch.setattr("validators.validate_generic_product", fake_generic)
    from validators import validate_product_url

    await validate_product_url(
        "https://www.snitch.co.in/products/slim-fit-shirt?color=navy"
    )
    assert captured["url"] == (
        "https://www.snitch.com/products/slim-fit-shirt?color=navy"
    )

    # New-shape snitch.com PDPs dispatch to the generic validator unchanged.
    new_pdp = (
        "https://www.snitch.com/men-shirts/"
        "regular-fit-black-shirt-4sfs145-02/9269896904866/buy"
    )
    await validate_product_url(new_pdp)
    assert captured["url"] == new_pdp

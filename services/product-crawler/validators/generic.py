"""Generic product-detail validator for any merchant with JSON-LD / OpenGraph."""
from __future__ import annotations

import re
from urllib.parse import urlparse

from engines.playwright_engine import fetch_rendered_html

from .common import (
    VerifiedProduct,
    absolute_image,
    detect_availability,
    get_canonical,
    get_jsonld_products,
    get_meta,
    get_soup,
    host_of,
    parse_price,
)

# Paths that indicate search/cart/login — not product detail pages.
_NON_PDP_PATHS = re.compile(
    r"/(search|cart|checkout|login|signin|signup|account|wishlist|collection[s]?)(/|$|\?)",
    re.I,
)


def _store_label(host: str) -> str:
    h = host.replace("www.", "")
    name = h.split(".")[0]
    return name.title() if name else "Store"


def _extract_product_fields(
    soup, url: str, jsonld: list[dict]
) -> tuple[str | None, str | None, float | None, str | None, str]:
    title = None
    image = None
    price: float | None = None
    brand: str | None = None
    currency = "INR"

    if jsonld:
        prod = jsonld[0]
        title = prod.get("name")
        img = prod.get("image")
        if isinstance(img, list) and img:
            image = str(img[0])
        elif isinstance(img, str):
            image = img
        b = prod.get("brand")
        if isinstance(b, dict):
            brand = str(b.get("name") or "").strip() or None
        elif isinstance(b, str):
            brand = b
        offers = prod.get("offers") or {}
        if isinstance(offers, list) and offers:
            offers = offers[0]
        if isinstance(offers, dict):
            price = parse_price(offers.get("price"))
            currency = str(offers.get("priceCurrency") or currency)

    if not title:
        title = get_meta(soup, "og:title", "twitter:title")
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not image:
        image = absolute_image(soup, url)
    if price is None:
        match = re.search(r"₹\s*[\d,]+|\$\s*[\d,]+", soup.get_text(" ", strip=True))
        if match:
            price = parse_price(match.group())
            if "$" in match.group():
                currency = "USD"

    return title, image, price, brand, currency


async def validate_generic_product(
    url: str,
) -> tuple[VerifiedProduct | None, str | None]:
    """Open any merchant PDP and confirm title + image via structured data."""
    parsed = urlparse(url)
    if not parsed.netloc:
        return None, "invalid url"
    path = parsed.path or ""
    if _NON_PDP_PATHS.search(path):
        return None, "not a product detail page"

    try:
        html = await fetch_rendered_html(url, scroll=False)
    except Exception as e:
        return None, f"fetch failed: {e}"
    if not html:
        return None, "empty html"

    soup = get_soup(html)
    jsonld = get_jsonld_products(soup)
    title, image, price, brand, currency = _extract_product_fields(soup, url, jsonld)
    canonical = get_canonical(soup, url)
    availability = detect_availability(soup, jsonld)

    if not title or len(title.strip()) < 4:
        return None, "missing or short title"
    if not image:
        return None, "missing image"
    if host_of(canonical) != host_of(url):
        canon_parts = host_of(canonical).split(".")[-2:]
        url_parts = host_of(url).split(".")[-2:]
        if canon_parts != url_parts:
            return None, "canonical url on different host"

    host = host_of(canonical)
    source = host.replace("www.", "").split(".")[0]

    verified: VerifiedProduct = {
        "title": title.strip(),
        "url": canonical,
        "canonicalUrl": canonical,
        "image": image,
        "price": price,
        "currency": currency,
        "brand": brand,
        "availability": availability,
        "source": source,
        "storeName": _store_label(host),
        "verified": True,
    }
    return verified, None

"""Flipkart product-detail validator."""
from __future__ import annotations

import re

from engines.html_quality import html_usable
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


async def validate_flipkart_product(
    url: str,
) -> tuple[VerifiedProduct | None, str | None]:
    """Open a Flipkart product detail URL and confirm it is a real item."""
    if "/p/itm" not in url:
        return None, "not a flipkart product detail url"

    try:
        html = await fetch_rendered_html(url, scroll=False)
    except Exception as e:
        return None, f"fetch failed: {e}"
    if not html or not html_usable(html):
        return None, "404 or challenge page"

    soup = get_soup(html)
    jsonld = get_jsonld_products(soup)

    title = None
    image = None
    price: float | None = None
    brand: str | None = None
    currency = "INR"

    # Prefer JSON-LD when present
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

    # Fallbacks via meta + page selectors
    if not title:
        title = get_meta(soup, "og:title", "twitter:title")
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not image:
        image = absolute_image(soup, url)
    if price is None:
        # Flipkart renders price as ₹X,XXX inside a div with class starting Nx9bqj
        match = re.search(r"₹\s*[\d,]+", soup.get_text(" ", strip=True))
        if match:
            price = parse_price(match.group())

    canonical = get_canonical(soup, url)
    availability = detect_availability(soup, jsonld)

    # Hard requirements
    if not title or len(title.strip()) < 4:
        return None, "missing or short title"
    if not image:
        return None, "missing image"
    if "flipkart.com" not in host_of(canonical):
        return None, "canonical url not on flipkart"

    verified: VerifiedProduct = {
        "title": title.strip(),
        "url": canonical,
        "canonicalUrl": canonical,
        "image": image,
        "price": price,
        "currency": currency,
        "brand": brand,
        "availability": availability,
        "source": "flipkart",
        "storeName": "Flipkart",
        "verified": True,
    }
    return verified, None

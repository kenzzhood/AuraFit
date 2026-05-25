"""Amazon product-detail validator."""
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


def _is_amazon_product_url(url: str) -> bool:
    """Amazon product URLs include /dp/ or /gp/product/ followed by an ASIN."""
    path = urlparse(url).path or ""
    return bool(re.search(r"/(?:dp|gp/product)/[A-Z0-9]{10}(?:/|$|\?)", path))


def _currency_from_host(host: str) -> str:
    if host.endswith(".in"):
        return "INR"
    if host.endswith(".co.uk"):
        return "GBP"
    if host.endswith(".de") or host.endswith(".fr") or host.endswith(".it") or host.endswith(".es"):
        return "EUR"
    if host.endswith(".ca"):
        return "CAD"
    if host.endswith(".com.au"):
        return "AUD"
    return "USD"


async def validate_amazon_product(
    url: str,
) -> tuple[VerifiedProduct | None, str | None]:
    """Open an Amazon product detail URL and confirm it is a real item."""
    if not _is_amazon_product_url(url):
        return None, "not an amazon product detail url"

    try:
        html = await fetch_rendered_html(url, scroll=False)
    except Exception as e:
        return None, f"fetch failed: {e}"
    if not html:
        return None, "empty html"

    soup = get_soup(html)
    host = host_of(url)
    jsonld = get_jsonld_products(soup)

    title = None
    image = None
    price: float | None = None
    brand: str | None = None
    currency = _currency_from_host(host)

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
        h1 = soup.find("span", id="productTitle")
        if h1:
            title = h1.get_text(strip=True)
        else:
            title = get_meta(soup, "og:title", "twitter:title")
    if not image:
        img_tag = soup.find("img", id="landingImage")
        if img_tag and img_tag.get("src"):
            image = str(img_tag["src"])
        elif img_tag and img_tag.get("data-old-hires"):
            image = str(img_tag["data-old-hires"])
        else:
            image = absolute_image(soup, url)
    if price is None:
        price_tag = soup.select_one("span.a-price > span.a-offscreen")
        if price_tag:
            price = parse_price(price_tag.get_text(strip=True))

    canonical = get_canonical(soup, url)
    availability = detect_availability(soup, jsonld)

    # Captcha / robot page → reject
    body_text = soup.get_text(" ", strip=True).lower()
    if "type the characters you see in this image" in body_text or "to discuss automated access to amazon data" in body_text:
        return None, "amazon bot-check page"

    if not title or len(title.strip()) < 4:
        return None, "missing or short title"
    if not image:
        return None, "missing image"
    if "amazon." not in host_of(canonical):
        return None, "canonical url not on amazon"

    verified: VerifiedProduct = {
        "title": title.strip(),
        "url": canonical,
        "canonicalUrl": canonical,
        "image": image,
        "price": price,
        "currency": currency,
        "brand": brand,
        "availability": availability,
        "source": "amazon",
        "storeName": "Amazon",
        "verified": True,
    }
    return verified, None

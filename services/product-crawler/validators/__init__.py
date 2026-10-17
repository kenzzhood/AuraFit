"""Product-detail validators."""
from __future__ import annotations

import re
from urllib.parse import urlparse

from .amazon import validate_amazon_product
from .common import VerifiedProduct
from .flipkart import validate_flipkart_product
from .generic import validate_generic_product

__all__ = [
    "VerifiedProduct",
    "validate_product_url",
    "validate_amazon_product",
    "validate_flipkart_product",
    "validate_generic_product",
    "rewrite_legacy_retailer_url",
    "is_usable_snitch_product_url",
]


def rewrite_legacy_retailer_url(url: str) -> str:
    """snitch.co.in moved to snitch.com — keep path and query."""
    parsed = urlparse(url)
    host = parsed.netloc or ""
    if "snitch.co.in" not in host.lower():
        return url
    new_host = re.sub(r"(?i)snitch\.co\.in", "snitch.com", host)
    return parsed._replace(netloc=new_host).geturl()


def is_usable_snitch_product_url(url: str) -> bool:
    """True only for live snitch.com PDPs: /<category>/<handle>/<numericId>/buy.

    The new snitch.com is a custom Next.js site — Shopify-era
    /products/<handle> paths render an empty "Oops! Can't Find That" shell,
    and old snitch.co.in handles cannot be mapped, so both are always False.
    """
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if "snitch.co.in" in host:
        return False
    if "snitch.com" not in host:
        return False
    parts = [p for p in (parsed.path or "").split("/") if p]
    return (
        len(parts) >= 4
        and parts[-1].lower() == "buy"
        and re.fullmatch(r"[0-9]+", parts[-2]) is not None
    )


async def validate_product_url(url: str) -> tuple[VerifiedProduct | None, str | None]:
    """Dispatch a candidate URL to the right store-specific validator."""
    url = rewrite_legacy_retailer_url(url)
    host = (urlparse(url).netloc or "").lower()
    if "flipkart.com" in host:
        return await validate_flipkart_product(url)
    if "amazon." in host:
        return await validate_amazon_product(url)
    return await validate_generic_product(url)

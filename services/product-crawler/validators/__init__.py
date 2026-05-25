"""Product-detail validators.

The crawler's search endpoints surface URLs that *look* like product pages.
Only after one of these validators successfully extracts a canonical URL,
title, image, and availability state from the actual detail page do we treat
a product as real and shoppable. Anything else stays a candidate.
"""
from __future__ import annotations

from urllib.parse import urlparse

from .amazon import validate_amazon_product
from .common import VerifiedProduct
from .flipkart import validate_flipkart_product

__all__ = [
    "VerifiedProduct",
    "validate_product_url",
    "validate_amazon_product",
    "validate_flipkart_product",
]


async def validate_product_url(url: str) -> tuple[VerifiedProduct | None, str | None]:
    """Dispatch a candidate URL to the right store-specific validator.

    Returns (verified, None) on success or (None, reason) on rejection.
    """
    host = (urlparse(url).netloc or "").lower()
    if "flipkart.com" in host:
        return await validate_flipkart_product(url)
    if "amazon." in host:
        return await validate_amazon_product(url)
    return None, f"no validator for host: {host or 'unknown'}"

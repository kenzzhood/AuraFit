"""Product-detail validators."""
from __future__ import annotations

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
]


async def validate_product_url(url: str) -> tuple[VerifiedProduct | None, str | None]:
    """Dispatch a candidate URL to the right store-specific validator."""
    host = (urlparse(url).netloc or "").lower()
    if "flipkart.com" in host:
        return await validate_flipkart_product(url)
    if "amazon." in host:
        return await validate_amazon_product(url)
    return await validate_generic_product(url)

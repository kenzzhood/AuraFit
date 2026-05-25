"""Crawl4AI engine for semantic / structured extraction."""
from __future__ import annotations

from typing import Any

from extractors.fashion_product import parse_products_from_markdown


async def crawl_url(url: str, query: str) -> tuple[str, list[dict[str, Any]]]:
    try:
        from crawl4ai import AsyncWebCrawler

        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url)
            markdown = result.markdown or ""
            products = parse_products_from_markdown(markdown, url)
            for p in products:
                p.setdefault("source", "crawl")
                if query and "aestheticTags" not in p:
                    p["aestheticTags"] = query.split()[:5]
            return markdown, products
    except Exception as e:
        print(f"Crawl4AI failed for {url}: {e}")
        return "", []


async def extract_products(url: str, query: str, html: str | None = None) -> list[dict[str, Any]]:
    """Prefer Crawl4AI; fallback to markdown parse of provided HTML."""
    _, products = await crawl_url(url, query)
    if products:
        return products
    if html:
        return parse_products_from_markdown(html, url)
    return []

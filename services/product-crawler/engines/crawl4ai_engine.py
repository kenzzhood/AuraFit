"""Crawl4AI engine for semantic / structured extraction.

Optional: crawl4ai is not in requirements.txt because it pins lxml 5.x while
Scrapling needs lxml 6.x. HTML parse still runs; this import fails closed.
"""
from __future__ import annotations

from typing import Any

from extractors.fashion_product import (
    parse_products_from_html,
    parse_products_from_markdown,
    parse_products_from_response,
)


async def crawl_url(url: str, query: str) -> tuple[str, list[dict[str, Any]]]:
    try:
        from crawl4ai import AsyncWebCrawler

        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url)
            markdown = result.markdown or ""
            html = result.html or ""
            products = parse_products_from_html(html, url) if html else []
            if not products:
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
    """Parse provided HTML/JSON first; only call Crawl4AI when no candidates found."""
    if html:
        products = parse_products_from_response(html, url)
        if not products:
            products = parse_products_from_markdown(html, url)
        if products:
            for p in products:
                p.setdefault("source", "crawl")
                if query and "aestheticTags" not in p:
                    p["aestheticTags"] = query.split()[:5]
            return products

    _, products = await crawl_url(url, query)
    return products

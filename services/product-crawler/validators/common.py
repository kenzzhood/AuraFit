"""Shared HTML-parsing helpers for product-detail validators."""
from __future__ import annotations

import json
import re
from typing import Any, TypedDict
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

OUT_OF_STOCK_PATTERNS = [
    r"currently\s+unavailable",
    r"out\s+of\s+stock",
    r"sold\s+out",
    r"item\s+not\s+available",
    r"this\s+item\s+is\s+no\s+longer",
]


class VerifiedProduct(TypedDict, total=False):
    """The contract every validator returns on success.

    Anything with ``verified: True`` has been confirmed against a real product
    detail page — its image and URL can be safely shown to users and used as
    ingredients in image generation.
    """

    title: str
    url: str
    canonicalUrl: str
    image: str
    price: float | None
    currency: str
    brand: str | None
    availability: str  # "in_stock" | "out_of_stock" | "unknown"
    source: str
    storeName: str
    verified: bool


def get_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html or "", "lxml")


def get_meta(soup: BeautifulSoup, *names: str) -> str | None:
    """Return content of the first matching meta tag (by name or property)."""
    for name in names:
        tag = soup.find("meta", attrs={"property": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return str(tag["content"]).strip()
    return None


def get_canonical(soup: BeautifulSoup, fallback_url: str) -> str:
    link = soup.find("link", attrs={"rel": "canonical"})
    href = link.get("href") if link and link.get("href") else None
    if href:
        return urljoin(fallback_url, str(href).strip())
    og = get_meta(soup, "og:url")
    if og:
        return urljoin(fallback_url, og)
    return fallback_url


def get_jsonld_products(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Return every JSON-LD block of @type Product (or item lists containing
    them), flattened into individual product dicts."""
    out: list[dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = tag.string or tag.get_text() or ""
        text = text.strip()
        if not text:
            continue
        try:
            data = json.loads(text)
        except Exception:
            continue
        for node in _walk_jsonld(data):
            t = node.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                out.append(node)
    return out


def _walk_jsonld(node: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if isinstance(node, dict):
        out.append(node)
        for v in node.values():
            out.extend(_walk_jsonld(v))
    elif isinstance(node, list):
        for v in node:
            out.extend(_walk_jsonld(v))
    return out


def parse_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return float(value)
        except Exception:
            return None
    s = str(value)
    # Strip everything that isn't a digit or dot
    cleaned = re.sub(r"[^\d.]", "", s.replace(",", ""))
    if not cleaned or cleaned == ".":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def detect_availability(soup: BeautifulSoup, jsonld_products: list[dict[str, Any]]) -> str:
    """Combine structured + text signals to classify availability."""
    # JSON-LD signal
    for prod in jsonld_products:
        offers = prod.get("offers") or {}
        if isinstance(offers, list) and offers:
            offers = offers[0]
        if isinstance(offers, dict):
            avail = str(offers.get("availability") or "").lower()
            if avail:
                if "instock" in avail or "in_stock" in avail:
                    return "in_stock"
                if "outofstock" in avail or "soldout" in avail or "discontinued" in avail:
                    return "out_of_stock"
    # Text signal — pull body text once
    text = soup.get_text(" ", strip=True).lower()
    for pat in OUT_OF_STOCK_PATTERNS:
        if re.search(pat, text):
            return "out_of_stock"
    # If "add to cart" / "buy now" buttons are visible we treat it as in-stock
    if re.search(r"add\s+to\s+cart|buy\s+now|add\s+to\s+bag", text):
        return "in_stock"
    return "unknown"


def absolute_image(soup: BeautifulSoup, base_url: str) -> str | None:
    og = get_meta(soup, "og:image", "og:image:secure_url", "twitter:image")
    if og:
        return urljoin(base_url, og)
    return None


def host_of(url: str) -> str:
    return (urlparse(url).netloc or "").lower()

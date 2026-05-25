"""Fashion product JSON schema for LLM / structured extraction."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlparse

PRODUCT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "brand": {"type": "string"},
        "price": {"type": "number"},
        "currency": {"type": "string"},
        "image": {"type": "string"},
        "url": {"type": "string"},
        "colors": {"type": "array", "items": {"type": "string"}},
        "category": {"type": "string"},
        "aestheticTags": {"type": "array", "items": {"type": "string"}},
        "rating": {"type": "number"},
        "availability": {"type": "string"},
    },
    "required": ["title", "url"],
}


# Titles that Flipkart / Amazon search pages emit for non-product links
# (category headers, "see more", footer banners, etc.). We never want these.
TITLE_BLOCKLIST = {
    "see more",
    "let us know",
    "india",
    "skip to main content",
    "next page",
    "previous page",
    "sponsored",
    "shop now",
    "all categories",
    "best sellers",
}


def _clean_url(raw: str, base_url: str) -> str | None:
    """Crawl4AI sometimes returns markdown URLs wrapped like
    ``https://www.flipkart.com/</actual-path?...> "title"``. Strip those wrappers
    and resolve relative paths. Returns None for placeholder/javascript URLs."""
    if not raw:
        return None
    s = raw.strip()
    # Drop trailing markdown title segment: '... "Some Title"'
    s = re.split(r'\s+"', s, maxsplit=1)[0]
    # Strip wrapping <...>
    s = s.strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1]
    # Inner-wrap pattern: https://host/<path>
    inner = re.match(r"^(https?://[^/]+)/<([^>]+)>$", s)
    if inner:
        s = inner.group(1) + "/" + inner.group(2).lstrip("/")
    s = s.strip()
    if not s:
        return None
    low = s.lower()
    if low.startswith("javascript:") or low.startswith("mailto:") or low in {"#", "/"}:
        return None
    if low.startswith("//"):
        s = "https:" + s
    elif s.startswith("/"):
        s = urljoin(base_url, s)
    # Reject any url that still looks like a placeholder
    if any(tok in s for tok in ("<#>", "void(0)", "void\\(0\\)")):
        return None
    return s


def _is_real_product_url(url: str, host_hint: str) -> bool:
    """Heuristic: real product detail pages on Flipkart end with /p/itm...,
    Amazon with /dp/<asin>. Anything else (categories, banners, search refines)
    is dropped so the user never sees a non-product link."""
    parsed = urlparse(url)
    if not parsed.netloc:
        return False
    path = parsed.path or ""
    if "flipkart.com" in host_hint:
        return "/p/itm" in path
    if "amazon." in host_hint:
        return "/dp/" in path or re.search(r"/[A-Z0-9]{10}(?:/|$)", path) is not None
    # Generic: at least 2 path segments, not just /search
    segments = [s for s in path.split("/") if s]
    return len(segments) >= 2 and "search" not in segments[0].lower()


def _title_ok(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t or len(t) < 4:
        return False
    if t in TITLE_BLOCKLIST:
        return False
    return True


def parse_products_from_markdown(markdown: str, base_url: str) -> list[dict[str, Any]]:
    """Heuristic extraction from Crawl4AI markdown output."""
    products: list[dict[str, Any]] = []
    lines = markdown.split("\n")
    current: dict[str, Any] = {}

    host_hint = urlparse(base_url).netloc

    def flush() -> None:
        if not current:
            return
        title = (current.get("title") or "").strip()
        raw_url = current.get("url") or ""
        url = _clean_url(raw_url, base_url)
        if (
            _title_ok(title)
            and url
            and _is_real_product_url(url, host_hint)
        ):
            products.append({**current, "title": title, "url": url})

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("![") and "](" in stripped:
            if current.get("title"):
                flush()
                current = {}
            try:
                url_part = stripped.split("](")[1].rstrip(")")
                cleaned = _clean_url(url_part, base_url)
                if cleaned:
                    current["image"] = cleaned
            except IndexError:
                pass
        elif stripped.startswith("[") and "](" in stripped and not stripped.startswith("!["):
            try:
                title = stripped.split("[")[1].split("]")[0]
                url = stripped.split("](")[1].rstrip(")")
                current["title"] = title
                current["url"] = url
            except IndexError:
                pass
        elif "₹" in stripped or "$" in stripped or "INR" in stripped.upper():
            nums = re.findall(r"[\d,]+\.?\d*", stripped.replace(",", ""))
            if nums:
                try:
                    current["price"] = float(nums[0])
                    current["currency"] = "INR" if "₹" in stripped else "USD"
                except ValueError:
                    pass

    flush()

    # Dedupe by url, preserving order
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for p in products:
        u = p.get("url", "")
        if u and u not in seen:
            seen.add(u)
            unique.append(p)
    return unique[:12]

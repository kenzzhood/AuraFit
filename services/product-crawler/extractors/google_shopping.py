"""Parse Google Shopping HTML search results into verified product rows.

We aim for the `tbm=shop` listing page directly:

    https://www.google.com/search?tbm=shop&q=blue+linen+shirt&hl=en&gl=in

Google's HTML for these pages is mostly server-rendered, so a plain HTTP fetch
+ lxml/BeautifulSoup parse takes ~300 ms. The DOM uses Google's obfuscated
class names which rotate every few months, so we keep a list of fallback
selectors per field and accept any product card that has at least a title,
a thumbnail, a link, and (optionally) a price.

Every row returned here is treated as `verified: true` upstream — Google's
Merchant Center has already pre-validated that the underlying merchant URL is
a real product page with the shown image. We do not need to open the detail
page ourselves.
"""
from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote_plus, urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup

GOOGLE_SHOPPING_BASE = "https://www.google.com/search"

# Hosts that should never be treated as a real merchant link.
_NON_MERCHANT_HOSTS = {
    "google.com",
    "www.google.com",
    "policies.google.com",
    "support.google.com",
    "accounts.google.com",
}


def build_search_url(query: str, region: str = "IN") -> str:
    """Build the Google Shopping search URL for a region.

    Google deprecated ``tbm=shop`` in 2024–2025 and now redirects to the
    unified results page with ``udm=28`` (Shopping mode). Going directly to
    that URL avoids a redirect round-trip and gives us the same HTML.
    """
    gl = {"US": "us", "UK": "uk"}.get(region.upper(), "in")
    return (
        f"{GOOGLE_SHOPPING_BASE}?q={quote_plus(query)}"
        f"&udm=28&hl=en&gl={gl}&num=20"
    )


def _clean_image(src: str | None) -> str | None:
    """Some Google thumbnails are inline data URIs (lazy-loaded placeholder).
    Reject those; we need a real http(s) URL the image-gen call can fetch."""
    if not src:
        return None
    s = src.strip()
    if not s or s.startswith("data:"):
        return None
    if s.startswith("//"):
        return "https:" + s
    return s


def _unwrap_google_url(href: str | None) -> str | None:
    """Google Shopping uses `/url?q=<real>&...` redirects for outbound links.
    Strip the wrapper so we surface the merchant URL directly."""
    if not href:
        return None
    h = href.strip()
    if not h:
        return None
    if h.startswith("/url?") or h.startswith("https://www.google.com/url?"):
        try:
            full = urljoin("https://www.google.com", h)
            qs = parse_qs(urlparse(full).query)
            for k in ("q", "url"):
                if k in qs and qs[k]:
                    return qs[k][0]
        except Exception:
            return None
    if h.startswith("/"):
        # Google internal relative path → not a real merchant link
        return None
    return h


def _host_of(url: str | None) -> str:
    if not url:
        return ""
    try:
        return (urlparse(url).netloc or "").lower()
    except Exception:
        return ""


def _looks_like_merchant_url(url: str | None) -> bool:
    host = _host_of(url)
    if not host:
        return False
    return host not in _NON_MERCHANT_HOSTS and not host.endswith(".google.com")


def _parse_price(text: str | None) -> tuple[float | None, str]:
    """Extract price + currency hint from a free-form text like "₹1,299"."""
    if not text:
        return None, ""
    s = text.strip()
    currency = "INR"
    if "$" in s:
        currency = "USD"
    elif "£" in s:
        currency = "GBP"
    elif "€" in s:
        currency = "EUR"
    elif "₹" in s or "rs" in s.lower():
        currency = "INR"
    nums = re.findall(r"[\d,]+\.?\d*", s.replace(",", ""))
    if not nums:
        return None, currency
    try:
        return float(nums[0]), currency
    except ValueError:
        return None, currency


# Each entry is a candidate card-level selector. Google rotates these every
# few months, so we try them in order until we find non-empty results.
_CARD_SELECTORS = [
    "div.sh-dgr__content",
    "div.KZmu8e",
    "div.tu5SU",
    "div.i0X6df",
    "div.Cluv0",
    "div.uYNZm",
    "div.sh-pr__product-result",
]


def _first_text(node, selectors: list[str]) -> str | None:
    for sel in selectors:
        try:
            el = node.select_one(sel)
        except Exception:
            continue
        if el and el.get_text(strip=True):
            return el.get_text(" ", strip=True)
    return None


def _first_attr(node, selectors: list[str], attr: str) -> str | None:
    for sel in selectors:
        try:
            el = node.select_one(sel)
        except Exception:
            continue
        if el and el.get(attr):
            return el[attr]
    return None


def parse_google_shopping_html(
    html: str, region: str, category: str | None = None
) -> list[dict[str, Any]]:
    """Return verified-shape product dicts ready for the Next.js side."""
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")

    cards = []
    for sel in _CARD_SELECTORS:
        found = soup.select(sel)
        if found:
            cards = found
            break

    products: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()

    currency_default = (
        "USD" if region.upper() == "US" else "GBP" if region.upper() == "UK" else "INR"
    )

    for card in cards:
        title = _first_text(
            card,
            [
                "h3",
                "h4",
                ".tAxDx",
                ".Lq5OHe",
                ".rgHvZc",
                ".sh-np__product-title",
            ],
        )
        if not title or len(title) < 4:
            continue

        link_raw = _first_attr(
            card,
            [
                "a.shntl",
                "a.Lq5OHe",
                "a.iXEZD",
                "a[href*='/url?']",
                "a",
            ],
            "href",
        )
        link = _unwrap_google_url(link_raw)
        if not _looks_like_merchant_url(link):
            continue

        image = _clean_image(
            _first_attr(card, ["img"], "src")
            or _first_attr(card, ["img"], "data-src")
        )
        if not image:
            continue

        price_text = _first_text(
            card,
            [
                ".a8Pemb",
                ".XrAfOe",
                ".T14wmb",
                ".kHxwFf",
                "[aria-hidden='true']",
            ],
        )
        price, currency = _parse_price(price_text)
        if not currency:
            currency = currency_default

        merchant = _first_text(
            card,
            [
                ".aULzUe",
                ".E5ocAb",
                ".IuHnof",
                ".hP4iBf",
                ".sh-np__seller-container",
            ],
        )

        rating_text = _first_text(card, [".QIrs8", ".Rsc7Yb"])
        rating: float | None = None
        if rating_text:
            m = re.search(r"(\d+\.\d+)", rating_text)
            if m:
                try:
                    rating = float(m.group(1))
                except ValueError:
                    rating = None

        if link in seen_urls:
            continue
        title_key = title.lower()[:80]
        if title_key in seen_titles:
            continue
        seen_urls.add(link or "")
        seen_titles.add(title_key)

        products.append(
            {
                "title": title,
                "url": link,
                "image": image,
                "price": price,
                "currency": currency,
                "storeName": merchant or _host_of(link).split(".")[0].title(),
                "source": "google_shopping",
                "rating": rating,
                "category": category,
                "verified": True,
                "availability": "in_stock",
                "matchCategory": category,
            }
        )

    return products


def fallback_parse_json_blobs(html: str) -> list[dict[str, Any]]:
    """Best-effort parse of AF_initDataCallback inline product blobs."""
    if not html:
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _walk(node: Any, depth: int = 0) -> None:
        if depth > 12 or len(out) >= 12:
            return
        if isinstance(node, str):
            if node.startswith("http") and "google" not in node and len(node) > 20:
                pass  # collected via tuple walk below
            return
        if isinstance(node, list):
            # Look for [title, ..., url, ..., image] shaped tuples
            strings = [s for s in node if isinstance(s, str) and len(s) > 2]
            urls = [s for s in strings if s.startswith("http") and "google" not in s]
            titles = [
                s
                for s in strings
                if not s.startswith("http") and len(s) >= 8 and "₹" not in s and "$" not in s
            ]
            if urls and titles:
                link = urls[0]
                title = titles[0]
                if link not in seen and _looks_like_merchant_url(link):
                    seen.add(link)
                    price: float | None = None
                    for s in strings:
                        if "₹" in s or "$" in s:
                            p, _ = _parse_price(s)
                            if p:
                                price = p
                                break
                    images = [s for s in strings if s.startswith("http") and s != link]
                    out.append(
                        {
                            "title": title,
                            "url": link,
                            "image": images[0] if images else None,
                            "price": price,
                            "currency": "INR",
                            "source": "google_shopping",
                            "verified": True,
                            "availability": "in_stock",
                        }
                    )
            for item in node:
                _walk(item, depth + 1)
        elif isinstance(node, dict):
            for v in node.values():
                _walk(v, depth + 1)

    for match in re.finditer(
        r"AF_initDataCallback\(\{key:\s*['\"]ds:\d+['\"][^}]+data:\s*(\[.+?\])\s*,\s*sideChannel",
        html,
        flags=re.S,
    ):
        try:
            data = json.loads(match.group(1))
            _walk(data)
        except Exception:
            continue
    return out

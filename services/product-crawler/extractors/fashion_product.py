"""Fashion product JSON schema for LLM / structured extraction."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from validators import is_usable_snitch_product_url, rewrite_legacy_retailer_url

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
    "home",
    "sign in",
    "login",
}


def _clean_url(raw: str, base_url: str) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    s = re.split(r'\s+"', s, maxsplit=1)[0]
    s = s.strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1]
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
    if any(tok in s for tok in ("<#>", "void(0)", "void\\(0\\)")):
        return None
    return rewrite_legacy_retailer_url(s)


def _is_real_product_url(url: str, host_hint: str) -> bool:
    parsed = urlparse(url)
    if not parsed.netloc:
        return False
    path = (parsed.path or "").lower()
    host = host_hint.lower()

    if "flipkart.com" in host:
        return "/p/itm" in path
    if "amazon." in host:
        return "/dp/" in path or re.search(r"/[a-z0-9]{10}(?:/|$)", path) is not None
    if "myntra.com" in host:
        return (
            "/buy" in path
            or re.search(r"/\d{5,}(?:/buy)?/?$", path) is not None
            or re.search(r"/[a-z0-9-]+/\d{6,}", path) is not None
        )
    if "ajio.com" in host:
        return "/p/" in path and "search" not in path
    if "snitch.com" in host or "snitch.co.in" in host:
        return is_usable_snitch_product_url(url)
    if "bananaclub" in host:
        # Must have a real product handle after /products/ (not just the listing page)
        return bool(re.search(r"/products/[a-zA-Z0-9][a-zA-Z0-9_-]{2,}", path))
    if "nykaafashion.com" in host or "nykaa.com" in host:
        return "/p/" in path or "/product/" in path
    if "tatacliq.com" in host:
        return "/p-" in path or re.search(r"/p/[a-z0-9-]+", path) is not None
    if "zara.com" in host:
        return "-p" in path or re.search(r"/\d+\.html", path) is not None
    if "hm.com" in host:
        return ".html" in path and "search" not in path
    if "uniqlo.com" in host:
        return "/products/" in path or re.search(r"/\d{8,}", path) is not None
    if "asos.com" in host:
        return "/prd/" in path or re.search(r"/\d{6,}", path) is not None
    if "meesho.com" in host:
        return "/p/" in path or "/product/" in path
    if "westside.com" in host or "lifestylestores.com" in host:
        return "/products/" in path or "/p/" in path
    if "maxfashion.in" in host:
        return "/p/" in path or "/product/" in path or bool(re.search(r"/\d{5,}", path))
    if "bewakoof.com" in host:
        return "/p/" in path or bool(re.search(r"/[a-z0-9-]{8,}", path))
    if "thesouledstore.com" in host:
        return "/product/" in path or "/products/" in path
    if "urbanic.com" in host:
        return "/goods/" in path or "/product/" in path
    if "shoppersstop.com" in host or "marksandspencer.in" in host:
        return "/p/" in path or "/product/" in path

    segments = [s for s in path.split("/") if s]
    if len(segments) < 2:
        return False
    if segments[0] in {"search", "cart", "checkout", "login", "account", "collections"}:
        return False
    return True


def _title_ok(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t or len(t) < 4:
        return False
    if t in TITLE_BLOCKLIST:
        return False
    return True


def _append_product(
    products: list[dict[str, Any]],
    title: str,
    url: str | None,
    base_url: str,
    host_hint: str,
    image: str | None = None,
) -> None:
    cleaned = _clean_url(url or "", base_url) if url else None
    if not _title_ok(title) or not cleaned or not _is_real_product_url(cleaned, host_hint):
        return
    entry: dict[str, Any] = {"title": title.strip(), "url": cleaned}
    if image:
        img = _clean_url(image, base_url)
        if img:
            entry["image"] = img
    products.append(entry)


def _extract_price(text: str) -> float | None:
    if not text:
        return None
    nums = re.findall(r"[\d,]+\.?\d*", text.replace(",", ""))
    if not nums:
        return None
    try:
        return float(nums[0])
    except ValueError:
        return None


def _dedupe_products(products: list[dict[str, Any]], limit: int = 12) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for p in products:
        u = p.get("url", "")
        if u and u not in seen:
            seen.add(u)
            unique.append(p)
    return unique[:limit]


def parse_products_from_asos_json(content: str, base_url: str) -> list[dict[str, Any]]:
    """Parse ASOS product search JSON API response."""
    import json

    try:
        data = json.loads(content)
    except Exception:
        return []

    products: list[dict[str, Any]] = []
    items = data.get("products") or data.get("items") or []
    if not isinstance(items, list):
        return []

    for item in items:
        if not isinstance(item, dict):
            continue
        pid = item.get("id")
        name = item.get("name") or item.get("title") or ""
        if not name or not pid:
            continue
        slug = item.get("url") or item.get("productUrl") or f"prd/{pid}"
        if str(slug).startswith("http"):
            url = str(slug)
        else:
            url = urljoin("https://www.asos.com/", str(slug).lstrip("/"))
        image = None
        img_data = item.get("imageUrl") or item.get("thumbnailUrl")
        if isinstance(img_data, str):
            image = img_data
        elif isinstance(img_data, dict):
            image = img_data.get("url") or img_data.get("src")
        price_block = item.get("price") or item.get("current")
        price = None
        currency = "GBP"
        if isinstance(price_block, dict):
            price = price_block.get("value") or price_block.get("current", {}).get("value")
            currency = price_block.get("currency") or currency
        elif isinstance(price_block, (int, float)):
            price = float(price_block)
        entry: dict[str, Any] = {
            "title": str(name).strip(),
            "url": url,
            "source": "asos",
            "storeName": "ASOS",
        }
        if image:
            entry["image"] = image
        if price is not None:
            entry["price"] = float(price)
            entry["currency"] = currency
        products.append(entry)

    host_hint = urlparse(base_url).netloc
    return [
        p
        for p in products
        if _title_ok(p.get("title", "")) and _is_real_product_url(p["url"], host_hint)
    ][:12]


def _extract_myntra_cards(soup: BeautifulSoup, base_url: str, host_hint: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for li in soup.select("li.product-base, li.product-card, [class*='product-base']"):
        a = li.find("a", href=True)
        if not a:
            continue
        title = (
            (li.select_one(".product-brand") or li.select_one("h3") or a).get_text(strip=True)
            or a.get("title")
            or ""
        )
        brand_el = li.select_one(".product-brand")
        product_el = li.select_one(".product-product")
        if brand_el and product_el:
            title = f"{brand_el.get_text(strip=True)} {product_el.get_text(strip=True)}".strip()
        img = li.find("img")
        image = img.get("src") or img.get("data-src") if img else None
        price_el = li.select_one(".product-price, [class*='product-price']")
        price = _extract_price(price_el.get_text() if price_el else "")
        _append_product(products, title, a["href"], base_url, host_hint, image)
        if price is not None and products:
            products[-1]["price"] = price
            products[-1]["currency"] = "INR"
    return products


def _extract_ajio_cards(soup: BeautifulSoup, base_url: str, host_hint: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for card in soup.select("[class*='item'], [class*='product'], article"):
        a = card.find("a", href=True)
        if not a or "/p/" not in (a.get("href") or ""):
            continue
        title = (
            card.get("aria-label")
            or (card.select_one("[class*='name']") or a).get_text(strip=True)
            or a.get("title")
            or ""
        )
        img = card.find("img")
        image = img.get("src") or img.get("data-src") if img else None
        price_el = card.select_one("[data-testid*='price'], [class*='price']")
        price = _extract_price(price_el.get_text() if price_el else "")
        before = len(products)
        _append_product(products, title, a["href"], base_url, host_hint, image)
        if price is not None and len(products) > before:
            products[-1]["price"] = price
            products[-1]["currency"] = "INR"
    return products


def _extract_tatacliq_cards(soup: BeautifulSoup, base_url: str, host_hint: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for card in soup.select("[class*='ProductModule'], [class*='product'], li"):
        a = card.find("a", href=True)
        if not a:
            continue
        href = a.get("href") or ""
        if "/p-" not in href and "/p/" not in href:
            continue
        title = (
            card.select_one("[class*='ProductDescription'], h3, h2")
            or a
        ).get_text(strip=True) or a.get("title") or ""
        img = card.find("img")
        image = img.get("src") or img.get("data-src") if img else None
        price_el = card.select_one("[class*='Price'], [class*='price']")
        price = _extract_price(price_el.get_text() if price_el else "")
        before = len(products)
        _append_product(products, title, href, base_url, host_hint, image)
        if price is not None and len(products) > before:
            products[-1]["price"] = price
            products[-1]["currency"] = "INR"
    return products


def _extract_zara_cards(soup: BeautifulSoup, base_url: str, host_hint: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for el in soup.select("[data-productid], li.product-grid-product, article"):
        a = el.find("a", href=True)
        product_id = el.get("data-productid")
        if not a and not product_id:
            continue
        title = (
            el.select_one("[class*='product-name'], h2, h3")
            or a
        )
        title_text = title.get_text(strip=True) if title else ""
        if not title_text and a:
            title_text = a.get("title") or a.get("aria-label") or ""
        img = el.find("img")
        image = img.get("src") or img.get("data-src") if img else None
        href = a.get("href") if a else None
        before = len(products)
        _append_product(products, title_text, href, base_url, host_hint, image)
        if len(products) > before and product_id:
            products[-1]["externalId"] = str(product_id)
    return products


def _extract_hm_cards(soup: BeautifulSoup, base_url: str, host_hint: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for article in soup.select("article[data-productid], article.hm-product-item, li.product-item"):
        a = article.find("a", href=True)
        if not a:
            continue
        title = (
            article.select_one("h2, h3, [class*='item-heading']")
            or a
        ).get_text(strip=True) or a.get("title") or ""
        img = article.find("img")
        image = img.get("src") or img.get("data-src") if img else None
        price_el = article.select_one("[class*='price'], span.price")
        price = _extract_price(price_el.get_text() if price_el else "")
        before = len(products)
        _append_product(products, title, a["href"], base_url, host_hint, image)
        if price is not None and len(products) > before:
            products[-1]["price"] = price
            cur = "INR" if "en_in" in base_url.lower() else "GBP" if "en_gb" in base_url.lower() else "USD"
            products[-1]["currency"] = cur
        pid = article.get("data-productid")
        if pid and len(products) > before:
            products[-1]["externalId"] = str(pid)
    return products


def _store_specific_extract(html: str, base_url: str) -> list[dict[str, Any]]:
    """Run dedicated extractors for known retailer search pages."""
    host_hint = urlparse(base_url).netloc.lower()
    soup = BeautifulSoup(html, "lxml")
    host = host_hint

    if "myntra.com" in host:
        items = _extract_myntra_cards(soup, base_url, host_hint)
        if items:
            return _dedupe_products(items)
    if "ajio.com" in host:
        items = _extract_ajio_cards(soup, base_url, host_hint)
        if items:
            return _dedupe_products(items)
    if "tatacliq.com" in host:
        items = _extract_tatacliq_cards(soup, base_url, host_hint)
        if items:
            return _dedupe_products(items)
    if "zara.com" in host:
        items = _extract_zara_cards(soup, base_url, host_hint)
        if items:
            return _dedupe_products(items)
    if "hm.com" in host or "h&m" in host:
        items = _extract_hm_cards(soup, base_url, host_hint)
        if items:
            return _dedupe_products(items)
    return []


def parse_products_from_shopify_json(content: str, base_url: str) -> list[dict[str, Any]]:
    """Parse Shopify Ajax Search (`/search.json`) or products.json payloads."""
    import json

    try:
        data = json.loads(content)
    except Exception:
        return []

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get("results") or data.get("products") or []
    else:
        return []
    if not isinstance(items, list):
        return []

    host_hint = urlparse(base_url).netloc
    products: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("name") or "").strip()
        handle = str(item.get("handle") or "").strip()
        rel = str(item.get("url") or item.get("product_url") or "")
        if not rel and handle:
            rel = f"/products/{handle}"
        image = None
        img = item.get("featured_image") or item.get("image")
        if isinstance(img, dict):
            image = img.get("url") or img.get("src")
        elif isinstance(img, str):
            image = img
        elif isinstance(item.get("images"), list) and item["images"]:
            first = item["images"][0]
            if isinstance(first, dict):
                image = first.get("src") or first.get("url")
            elif isinstance(first, str):
                image = first
        before = len(products)
        _append_product(products, title, rel, base_url, host_hint, image if isinstance(image, str) else None)
        if len(products) <= before:
            continue
        price_raw = item.get("price")
        if price_raw is None and isinstance(item.get("variants"), list) and item["variants"]:
            v0 = item["variants"][0]
            if isinstance(v0, dict):
                price_raw = v0.get("price")
        if price_raw is not None:
            try:
                raw_s = str(price_raw).replace(",", "")
                val = float(raw_s)
                if "." not in raw_s:
                    val = val / 100.0
                products[-1]["price"] = val
                products[-1]["currency"] = "INR"
            except (TypeError, ValueError):
                pass
    return _dedupe_products(products)


def parse_products_from_response(content: str, base_url: str) -> list[dict[str, Any]]:
    """Parse search response — Shopify JSON, ASOS JSON, or HTML."""
    stripped = (content or "").lstrip()
    base_lower = base_url.lower()
    if "search.json" in base_lower or "/products.json" in base_lower:
        shopify = parse_products_from_shopify_json(content, base_url)
        if shopify:
            return shopify
    if "asos.com/api" in base_lower or (
        stripped.startswith("{") and '"products"' in stripped[:2000]
    ):
        asos = parse_products_from_asos_json(content, base_url)
        if asos:
            return asos
    if stripped.startswith("{") or stripped.startswith("["):
        import json

        try:
            data = json.loads(content)
            if isinstance(data, dict) and data.get("results"):
                shopify = parse_products_from_shopify_json(content, base_url)
                if shopify:
                    return shopify
            if isinstance(data, dict) and (data.get("products") or data.get("items")):
                return parse_products_from_asos_json(content, base_url)
        except Exception:
            pass
    return parse_products_from_html(content, base_url)


def parse_products_from_html(html: str, base_url: str) -> list[dict[str, Any]]:
    """Extract product candidates from search-result HTML via anchor heuristics."""
    if not html:
        return []
    products: list[dict[str, Any]] = []
    host_hint = urlparse(base_url).netloc
    soup = BeautifulSoup(html, "lxml")

    # Store-specific card extractors (higher signal than generic anchors)
    store_items = _store_specific_extract(html, base_url)
    if store_items:
        return store_items

    # JSON-LD ItemList on search pages
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = (script.string or script.get_text() or "").strip()
        if not text:
            continue
        try:
            import json

            data = json.loads(text)
        except Exception:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            if node.get("@type") == "ItemList":
                for item in node.get("itemListElement") or []:
                    if not isinstance(item, dict):
                        continue
                    prod = item.get("item") or item
                    if isinstance(prod, dict):
                        _append_product(
                            products,
                            str(prod.get("name") or ""),
                            str(prod.get("url") or ""),
                            base_url,
                            host_hint,
                            prod.get("image") if isinstance(prod.get("image"), str) else None,
                        )

    # Anchor tags linking to product detail pages
    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        title = a.get_text(strip=True) or a.get("title") or a.get("aria-label") or ""
        img_tag = a.find("img")
        image = None
        if img_tag:
            image = img_tag.get("src") or img_tag.get("data-src")
        _append_product(products, title, href, base_url, host_hint, image)

    return _dedupe_products(products)


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
        if _title_ok(title) and url and _is_real_product_url(url, host_hint):
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

    return _dedupe_products(products)

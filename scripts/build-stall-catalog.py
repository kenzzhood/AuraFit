#!/usr/bin/env python3
"""Collect a real offline Autofit catalog from public listing pages.

Live Amazon.in and Myntra block this network. Listings are read from the
Internet Archive (original HTML via the id_ modifier). Only products that
appear on those pages, with a downloaded product image, are kept.
"""

from __future__ import annotations

import gzip
import json
import re
import ssl
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "catalog"
IMG_DIR = OUT_DIR / "images"
UA = "Mozilla/5.0 (compatible; AutofitIGDC/1.0; +https://github.com/kenzzhood/AuraFit)"
CTX = ssl.create_default_context()

# category, page url, accessory hint or None
LISTINGS: list[tuple[str, str, str | None]] = [
    ("tops", "https://www.myntra.com/women-dresses", None),
    ("tops", "https://www.myntra.com/women-tops", None),
    ("tops", "https://www.myntra.com/men-tshirts", None),
    ("tops", "https://www.myntra.com/men-casual-shirts", None),
    ("tops", "https://www.myntra.com/women-shirts", None),
    ("tops", "https://www.myntra.com/kurtas", None),
    ("pants", "https://www.myntra.com/women-trousers", None),
    ("pants", "https://www.myntra.com/men-jeans", None),
    ("pants", "https://www.myntra.com/women-jeans", None),
    ("pants", "https://www.myntra.com/men-trousers", None),
    ("pants", "https://www.myntra.com/palazzos", None),
    ("coats", "https://www.myntra.com/women-jackets", None),
    ("coats", "https://www.myntra.com/men-jackets", None),
    ("coats", "https://www.myntra.com/coats", None),
    ("coats", "https://www.myntra.com/blazers", None),
    ("coats", "https://www.myntra.com/men-blazers", None),
    ("accessories", "https://www.myntra.com/watches", "watch"),
    ("accessories", "https://www.myntra.com/men-watches", "watch"),
    ("accessories", "https://www.myntra.com/women-watches", "watch"),
    ("accessories", "https://www.myntra.com/necklace", "necklace"),
    ("accessories", "https://www.myntra.com/necklaces", "necklace"),
    ("accessories", "https://www.myntra.com/women-heels", "shoe"),
    ("accessories", "https://www.myntra.com/casual-shoes", "shoe"),
    ("accessories", "https://www.myntra.com/sports-shoes", "shoe"),
    ("accessories", "https://www.myntra.com/caps", "hat"),
    ("accessories", "https://www.myntra.com/hats", "hat"),
]

AMAZON: list[tuple[str, str, str | None]] = [
    ("tops", "https://www.amazon.in/s?k=women+dress", None),
    ("tops", "https://www.amazon.in/s?k=men+shirt", None),
    ("pants", "https://www.amazon.in/s?k=men+jeans", None),
    ("pants", "https://www.amazon.in/s?k=women+trousers", None),
    ("coats", "https://www.amazon.in/s?k=men+jacket", None),
    ("coats", "https://www.amazon.in/s?k=women+jacket", None),
    ("accessories", "https://www.amazon.in/s?k=wrist+watch", "watch"),
    ("accessories", "https://www.amazon.in/s?k=necklace", "necklace"),
    ("accessories", "https://www.amazon.in/s?k=running+shoes", "shoe"),
    ("accessories", "https://www.amazon.in/s?k=baseball+cap", "hat"),
]

CAP = {"tops": 100, "pants": 100, "coats": 100, "accessories": 100}
lock = threading.Lock()


def fetch(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as res:
        raw = res.read(4_000_000)
        enc = (res.headers.get("Content-Encoding") or "").lower()
    if raw[:2] == b"\x1f\x8b" or enc == "gzip":
        try:
            raw = gzip.decompress(raw)
        except Exception:
            pass
    return raw


def cdx_best(page_url: str) -> tuple[str, str] | None:
    q = "https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(
        {
            "url": page_url,
            "output": "json",
            "fl": "timestamp,original,statuscode,mimetype,length",
            "filter": ["statuscode:200", "mimetype:text/html"],
            "from": "202301",
            "to": "202512",
            "limit": "30",
        },
        doseq=True,
    )
    try:
        raw = fetch(q, timeout=20)
    except Exception as exc:
        print(f"  cdx fail {page_url}: {exc}")
        return None
    try:
        rows = json.loads(raw.decode("utf-8", "ignore"))
    except Exception:
        return None
    best = None
    best_len = 40_000
    for row in rows[1:]:
        if len(row) < 5:
            continue
        ts, original, status, mime, length = row[:5]
        try:
            n = int(length)
        except Exception:
            continue
        if status != "200" or "html" not in mime:
            continue
        if n > best_len:
            best_len = n
            best = (ts, original)
    return best


def snapshot_html(ts: str, original: str) -> str:
    url = f"https://web.archive.org/web/{ts}id_/{original}"
    return fetch(url, timeout=40).decode("utf-8", "ignore")


def extract_myx(html: str) -> dict | None:
    key = "window.__myx = "
    i = html.find(key)
    if i < 0:
        return None
    i += len(key)
    while i < len(html) and html[i] in " \n\r\t":
        i += 1
    if i >= len(html) or html[i] != "{":
        return None
    depth = 0
    in_str = False
    esc = False
    for j in range(i, len(html)):
        c = html[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(html[i : j + 1])
                except Exception:
                    return None
    return None


def gender_of(value: str | None, title: str) -> str:
    g = (value or "").strip().lower()
    if g in ("women", "woman", "female", "girls"):
        return "women"
    if g in ("men", "man", "male", "boys"):
        return "men"
    if "unisex" in g or "unisex" in title.lower():
        return "unisex"
    return "unknown"


SHOE = ("shoe", "heel", "sneaker", "loafer", "boot", "sandal", "jutti", "flip flop", "footwear")
HAT = ("hat", "cap", "beanie", "fedora")
WATCH = ("watch",)
NECK = ("necklace", "pendant", "mangalsutra", "neck chain")


def accessory_type(title: str, category: str, hint: str | None) -> str | None:
    text = f"{title} {category}".lower()
    found = None
    if any(w in text for w in WATCH):
        found = "watch"
    elif any(w in text for w in NECK):
        found = "necklace"
    elif any(w in text for w in SHOE):
        found = "shoe"
    elif any(w in text for w in HAT):
        found = "hat"
    if found:
        return found
    if hint and (hint in text or hint in (category or "").lower()):
        return hint
    if hint and hint in ("watch", "necklace", "shoe", "hat"):
        # Listing page is already scoped (e.g. /watches). Trust it.
        return hint
    return None


def myntra_products(html: str, bucket: str, hint: str | None, captured: str) -> list[dict]:
    data = extract_myx(html)
    if not data:
        return []
    try:
        products = data["searchData"]["results"]["products"]
    except Exception:
        return []
    items = []
    for p in products:
        pid = p.get("productId")
        title = (p.get("productName") or p.get("product") or "").strip()
        landing = (p.get("landingPageUrl") or "").strip()
        image = (p.get("searchImage") or "").strip()
        price = p.get("price")
        if not pid or not title or not landing or not image or not isinstance(price, (int, float)):
            continue
        price = int(price)
        if price <= 0:
            continue
        if image.startswith("//"):
            image = "https:" + image
        image = image.replace("http://", "https://")
        if not image.startswith("https://"):
            continue
        acc = None
        if bucket == "accessories":
            acc = accessory_type(title, str(p.get("category") or ""), hint)
            if acc is None:
                continue
        url = landing if landing.startswith("http") else "https://www.myntra.com/" + landing.lstrip("/")
        if "myntra.com" not in url:
            continue
        mrp = p.get("mrp")
        items.append(
            {
                "id": f"myntra-{pid}",
                "title": title,
                "brand": (p.get("brand") or "").strip(),
                "priceInr": price,
                "mrpInr": int(mrp) if isinstance(mrp, (int, float)) and mrp else None,
                "url": url,
                "imageUrl": image,
                "store": "myntra",
                "category": bucket,
                "gender": gender_of(p.get("gender"), title),
                "accessoryType": acc,
                "color": (p.get("primaryColour") or None),
                "capturedAt": captured,
            }
        )
    return items


def amazon_products(html: str, bucket: str, hint: str | None, captured: str) -> list[dict]:
    if "api-services-support@amazon.com" in html or "Service Unavailable" in html[:500]:
        return []
    items = []
    seen = set()
    for m in re.finditer(r'data-asin="([A-Z0-9]{10})"', html):
        asin = m.group(1)
        if asin in seen:
            continue
        window = html[m.start() : m.start() + 12000]
        title_m = re.search(
            r'<span class="a-size-(?:base-plus|medium|small) a-color-base a-text-normal"[^>]*>([^<]+)</span>',
            window,
        )
        if not title_m:
            title_m = re.search(r"<h2[^>]*>\s*<a[^>]*>\s*<span[^>]*>([^<]+)</span>", window, re.S)
        img_m = re.search(r'(https://m\.media-amazon\.com/images/I/[^"\s]+)', window)
        price_m = re.search(r'a-price-whole">\s*([0-9][0-9,]*)', window)
        if not title_m or not img_m or not price_m:
            continue
        title = unescape(title_m.group(1)).strip()
        if len(title) < 4:
            continue
        price = int(price_m.group(1).replace(",", ""))
        if price <= 0:
            continue
        acc = None
        if bucket == "accessories":
            acc = accessory_type(title, "", hint)
            if acc is None:
                continue
        seen.add(asin)
        items.append(
            {
                "id": f"amazon-{asin}",
                "title": title,
                "brand": "",
                "priceInr": price,
                "mrpInr": None,
                "url": f"https://www.amazon.in/dp/{asin}",
                "imageUrl": img_m.group(1).split("._")[0] + "._AC_UL640_.jpg"
                if "._" in img_m.group(1)
                else img_m.group(1),
                "store": "amazon",
                "category": bucket,
                "gender": gender_of(None, title),
                "accessoryType": acc,
                "color": None,
                "capturedAt": captured,
            }
        )
    return items


def download_image(item: dict) -> dict | None:
    dest = IMG_DIR / f"{item['id']}.jpg"
    url = item["imageUrl"]
    try:
        if not dest.exists() or dest.stat().st_size < 2000:
            raw = fetch(url, timeout=20)
            if len(raw) < 2000:
                raise RuntimeError("tiny image")
            if raw[:3] == b"\xff\xd8\xff" or raw[:8] == b"\x89PNG\r\n\x1a\n" or raw[:4] == b"RIFF":
                dest.write_bytes(raw)
            else:
                # Some CDNs wrap the image. Keep only obvious images.
                if b"<html" in raw[:200].lower():
                    raise RuntimeError("html body")
                dest.write_bytes(raw)
        item = dict(item)
        item["image"] = f"/catalog/images/{item['id']}.jpg"
        item.pop("imageUrl", None)
        return item
    except Exception as exc:
        print(f"  img fail {item['id']}: {exc}")
        dest.unlink(missing_ok=True)
        return None


def collect_pages(pages: list[tuple[str, str, str | None]], parser) -> list[dict]:
    found: list[dict] = []
    counts = {k: 0 for k in CAP}

    def one(entry):
        bucket, page_url, hint = entry
        with lock:
            if counts[bucket] >= CAP[bucket] + 15:
                return []
        print(f"lookup {bucket} {page_url}")
        best = cdx_best(page_url)
        if not best:
            print(f"  no snapshot {page_url}")
            return []
        ts, original = best
        try:
            html = snapshot_html(ts, original)
        except Exception as exc:
            print(f"  snapshot fail {page_url}: {exc}")
            return []
        items = parser(html, bucket, hint, ts)
        print(f"  {page_url} -> {len(items)} products @ {ts}")
        return items

    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(one, e) for e in pages]
        for fut in as_completed(futs):
            batch = fut.result()
            for item in batch:
                with lock:
                    if counts[item["category"]] >= CAP[item["category"]] + 20:
                        continue
                    counts[item["category"]] += 1
                found.append(item)
    return found


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    raw_items = collect_pages(LISTINGS, myntra_products)
    print(f"myntra candidates {len(raw_items)}")
    amazon = collect_pages(AMAZON, amazon_products)
    print(f"amazon candidates {len(amazon)}")
    raw_items.extend(amazon)

    dedup = {}
    for item in raw_items:
        dedup.setdefault(item["id"], item)
    items = list(dedup.values())

    saved = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futs = [pool.submit(download_image, item) for item in items]
        for fut in as_completed(futs):
            got = fut.result()
            if got:
                saved.append(got)

    # Prefer a mix, then cap per category. Stable order by id.
    saved.sort(key=lambda x: (x["category"], x["store"], x["id"]))
    capped = []
    seen = {k: 0 for k in CAP}
    for item in saved:
        if seen[item["category"]] >= CAP[item["category"]]:
            continue
        seen[item["category"]] += 1
        capped.append(item)

    # Drop image files we did not keep.
    keep = {f"{item['id']}.jpg" for item in capped}
    for path in IMG_DIR.glob("*"):
        if path.name not in keep:
            path.unlink(missing_ok=True)

    by_cat_store: dict[str, dict[str, int]] = {}
    for item in capped:
        by_cat_store.setdefault(item["category"], {"myntra": 0, "amazon": 0})
        by_cat_store[item["category"]][item["store"]] += 1

    catalog = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "note": "Real products parsed from Internet Archive snapshots of public Amazon.in and Myntra listing pages. Live sites blocked automated access from the build environment. Nothing here is invented.",
        "counts": by_cat_store,
        "total": len(capped),
        "items": capped,
    }
    (OUT_DIR / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print(json.dumps({"counts": by_cat_store, "total": len(capped), "seconds": round(time.time() - t0, 1)}, indent=2))


if __name__ == "__main__":
    main()

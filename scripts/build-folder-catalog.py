#!/usr/bin/env python3
"""Build the folder catalog from real Myntra and Amazon.in listings.

Each category folder gets items.json plus the product photos. Re-run this
script from the repo root with Python 3. It uses path joins only.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "catalog"
OLD_JSON = OUT / "catalog.json"
OLD_IMG = OUT / "images"

STYLES = [
    "old-money",
    "aesthetic",
    "casual",
    "formal",
    "festive",
    "streetwear",
    "y2k",
    "minimalist",
    "boho",
    "party",
    "sporty",
    "korean",
    "vintage",
    "smart-casual",
]
CAPS = {"tops": 200, "bottoms": 200, "coats": 180, "dresses": 200, "accessories": 200}
ACC_CAP = 55
FOLDERS = {
    "tops": ["tops"],
    "bottoms": ["bottoms"],
    "coats": ["coats"],
    "dresses": ["dresses"],
    "watch": ["accessories", "watches"],
    "necklace": ["accessories", "necklaces"],
    "shoe": ["accessories", "shoes"],
    "hat": ["accessories", "hats"],
}

# category, url, accessory hint, style, gender hint
PAGES: list[tuple[str, str, str | None, str, str | None]] = []


def page(category: str, style: str, urls: list[str], hint: str | None = None, gender: str | None = None) -> None:
    for url in urls:
        PAGES.append((category, url, hint, style, gender))


page("tops", "casual", ["https://www.myntra.com/men-tshirts", "https://www.myntra.com/men-tshirts?p=2", "https://www.myntra.com/women-tops", "https://www.myntra.com/women-tops?p=2"])
page("tops", "formal", ["https://www.myntra.com/men-formal-shirts", "https://www.myntra.com/men-formal-shirts?p=2", "https://www.myntra.com/women-formal-shirts"])
page("tops", "smart-casual", ["https://www.myntra.com/men-casual-shirts", "https://www.myntra.com/men-casual-shirts?p=2", "https://www.myntra.com/polo-tshirts", "https://www.myntra.com/women-shirts"])
page("tops", "old-money", ["https://www.myntra.com/linen-shirts", "https://www.myntra.com/men-polos"])
page("tops", "streetwear", ["https://www.myntra.com/hoodies", "https://www.myntra.com/men-sweatshirts", "https://www.myntra.com/women-sweatshirts", "https://www.myntra.com/sweatshirts"])
page("tops", "korean", ["https://www.myntra.com/oversized-tshirts", "https://www.myntra.com/men-shirts?f=Brand%3AHuenoir"])
page("tops", "y2k", ["https://www.myntra.com/crop-tops", "https://www.myntra.com/women-crop-tops", "https://www.myntra.com/corset-tops"])
page("tops", "festive", ["https://www.myntra.com/kurtas", "https://www.myntra.com/men-kurtas", "https://www.myntra.com/women-kurtas", "https://www.myntra.com/kurtas?p=2"])
page("tops", "sporty", ["https://www.myntra.com/sports-tshirts", "https://www.myntra.com/men-sports-tshirts"])
page("tops", "party", ["https://www.myntra.com/party-tops", "https://www.myntra.com/women-party-tops"])
page("tops", "boho", ["https://www.myntra.com/kaftan", "https://www.myntra.com/women-tunics"])
page("tops", "minimalist", ["https://www.myntra.com/tank-tops", "https://www.myntra.com/women-camisoles"])
page("tops", "vintage", ["https://www.myntra.com/denim-shirts"])
page("tops", "aesthetic", ["https://www.myntra.com/women-blouses"])
page("bottoms", "casual", ["https://www.myntra.com/men-jeans", "https://www.myntra.com/men-jeans?p=2", "https://www.myntra.com/women-jeans", "https://www.myntra.com/women-jeans?p=2"])
page("bottoms", "formal", ["https://www.myntra.com/men-formal-trousers", "https://www.myntra.com/women-trousers", "https://www.myntra.com/men-trousers"])
page("bottoms", "smart-casual", ["https://www.myntra.com/chinos", "https://www.myntra.com/men-chinos", "https://www.myntra.com/men-trousers?p=2"])
page("bottoms", "streetwear", ["https://www.myntra.com/cargo-pants", "https://www.myntra.com/men-cargo-pants", "https://www.myntra.com/cargo-joggers"])
page("bottoms", "sporty", ["https://www.myntra.com/track-pants", "https://www.myntra.com/men-track-pants", "https://www.myntra.com/women-track-pants"])
page("bottoms", "festive", ["https://www.myntra.com/palazzos", "https://www.myntra.com/sharara", "https://www.myntra.com/churidar", "https://www.myntra.com/dhoti-pants"])
page("bottoms", "boho", ["https://www.myntra.com/skirts", "https://www.myntra.com/maxi-skirts", "https://www.myntra.com/women-palazzos"])
page("bottoms", "y2k", ["https://www.myntra.com/low-rise-jeans", "https://www.myntra.com/mini-skirts"])
page("bottoms", "old-money", ["https://www.myntra.com/linen-trousers", "https://www.myntra.com/wide-leg-trousers"])
page("bottoms", "korean", ["https://www.myntra.com/wide-leg-jeans"])
page("bottoms", "vintage", ["https://www.myntra.com/denim-shorts"])
page("bottoms", "party", ["https://www.myntra.com/sequin-skirts"])
page("bottoms", "minimalist", ["https://www.myntra.com/leggings"])
page("coats", "casual", ["https://www.myntra.com/men-jackets", "https://www.myntra.com/women-jackets", "https://www.myntra.com/jackets"])
page("coats", "formal", ["https://www.myntra.com/blazers", "https://www.myntra.com/men-blazers", "https://www.myntra.com/women-blazers", "https://www.myntra.com/blazers?p=2"])
page("coats", "old-money", ["https://www.myntra.com/coats", "https://www.myntra.com/men-coats", "https://www.myntra.com/trench-coat"])
page("coats", "streetwear", ["https://www.myntra.com/bomber-jackets", "https://www.myntra.com/puffer-jackets", "https://www.myntra.com/varsity-jackets"])
page("coats", "festive", ["https://www.myntra.com/sherwani", "https://www.myntra.com/nehru-jackets", "https://www.myntra.com/men-nehru-jackets"])
page("coats", "vintage", ["https://www.myntra.com/denim-jackets", "https://www.myntra.com/women-denim-jackets"])
page("coats", "party", ["https://www.myntra.com/women-shrugs", "https://www.myntra.com/shrugs"])
page("coats", "smart-casual", ["https://www.myntra.com/waistcoats", "https://www.myntra.com/men-waistcoats"])
page("coats", "korean", ["https://www.myntra.com/oversized-jackets"])
page("coats", "minimalist", ["https://www.myntra.com/longline-jackets"])
page("dresses", "casual", ["https://www.myntra.com/dresses", "https://www.myntra.com/women-dresses", "https://www.myntra.com/dresses?p=2", "https://www.myntra.com/women-dresses?p=2"])
page("dresses", "party", ["https://www.myntra.com/bodycon-dresses", "https://www.myntra.com/party-dresses", "https://www.myntra.com/cocktail-dresses"])
page("dresses", "boho", ["https://www.myntra.com/maxi-dresses", "https://www.myntra.com/women-maxi-dresses"])
page("dresses", "festive", ["https://www.myntra.com/saree", "https://www.myntra.com/sarees", "https://www.myntra.com/lehenga-choli", "https://www.myntra.com/anarkali", "https://www.myntra.com/lehenga", "https://www.myntra.com/sarees?p=2"])
page("dresses", "formal", ["https://www.myntra.com/shirt-dresses", "https://www.myntra.com/a-line-dresses"])
page("dresses", "y2k", ["https://www.myntra.com/mini-dresses", "https://www.myntra.com/corset-dresses"])
page("dresses", "aesthetic", ["https://www.myntra.com/floral-dresses", "https://www.myntra.com/white-dresses"])
page("dresses", "korean", ["https://www.myntra.com/fit-and-flare-dresses"])
page("dresses", "vintage", ["https://www.myntra.com/wrap-dresses"])
page("dresses", "minimalist", ["https://www.myntra.com/slip-dresses"])
page("dresses", "old-money", ["https://www.myntra.com/midi-dresses"])
page("dresses", "smart-casual", ["https://www.myntra.com/sweater-dresses"])
page("accessories", "smart-casual", ["https://www.myntra.com/watches", "https://www.myntra.com/men-watches", "https://www.myntra.com/watches?p=2"], "watch")
page("accessories", "formal", ["https://www.myntra.com/women-watches", "https://www.myntra.com/analog-watches"], "watch")
page("accessories", "sporty", ["https://www.myntra.com/digital-watches", "https://www.myntra.com/sports-watches"], "watch")
page("accessories", "minimalist", ["https://www.myntra.com/women-analogue-watches"], "watch")
page("accessories", "festive", ["https://www.myntra.com/necklace", "https://www.myntra.com/necklaces", "https://www.myntra.com/mangalsutra", "https://www.myntra.com/pendant"], "necklace")
page("accessories", "party", ["https://www.myntra.com/choker", "https://www.myntra.com/women-necklaces"], "necklace")
page("accessories", "old-money", ["https://www.myntra.com/pearl-necklace", "https://www.myntra.com/gold-necklace"], "necklace")
page("accessories", "minimalist", ["https://www.myntra.com/chain-necklace"], "necklace")
page("accessories", "casual", ["https://www.myntra.com/casual-shoes", "https://www.myntra.com/sneakers", "https://www.myntra.com/men-casual-shoes"], "shoe")
page("accessories", "sporty", ["https://www.myntra.com/sports-shoes", "https://www.myntra.com/running-shoes", "https://www.myntra.com/men-sports-shoes"], "shoe")
page("accessories", "party", ["https://www.myntra.com/women-heels", "https://www.myntra.com/heels", "https://www.myntra.com/stilettos"], "shoe")
page("accessories", "festive", ["https://www.myntra.com/jutti", "https://www.myntra.com/mojari", "https://www.myntra.com/ethnic-footwear"], "shoe")
page("accessories", "old-money", ["https://www.myntra.com/loafers", "https://www.myntra.com/men-loafers"], "shoe")
page("accessories", "formal", ["https://www.myntra.com/formal-shoes", "https://www.myntra.com/men-formal-shoes", "https://www.myntra.com/women-flats"], "shoe")
page("accessories", "streetwear", ["https://www.myntra.com/caps", "https://www.myntra.com/men-caps", "https://www.myntra.com/baseball-caps"], "hat")
page("accessories", "vintage", ["https://www.myntra.com/hats", "https://www.myntra.com/fedora"], "hat")
page("accessories", "sporty", ["https://www.myntra.com/beanies", "https://www.myntra.com/caps?p=2"], "hat")
page("accessories", "festive", ["https://www.myntra.com/turban"], "hat")
page("tops", "casual", ["https://www.amazon.in/s?k=men+casual+shirt", "https://www.amazon.in/s?k=women+top"], None, None)
page("dresses", "festive", ["https://www.amazon.in/s?k=saree", "https://www.amazon.in/s?k=lehenga"], None, "women")
page("bottoms", "casual", ["https://www.amazon.in/s?k=men+jeans", "https://www.amazon.in/s?k=women+jeans"])
page("coats", "formal", ["https://www.amazon.in/s?k=men+blazer"])
page("accessories", "sporty", ["https://www.amazon.in/s?k=running+shoes"], "shoe")
page("accessories", "formal", ["https://www.amazon.in/s?k=analog+watch"], "watch")

KEYWORDS = [
    ("festive", ("saree", "lehenga", "sherwani", "anarkali", "kurta", "ethnic", "nehru", "sharara", "churidar", "dhoti", "dupatta", "bandhgal", "jutti", "mojari")),
    ("y2k", ("y2k", "crop", "corset", "low rise", "rhinestone", "baby tee")),
    ("korean", ("korean", "oversized")),
    ("streetwear", ("hoodie", "cargo", "graphic", "bomber", "varsity", "jogger")),
    ("sporty", ("sport", "track", "running", "jersey", "training", "athletic")),
    ("party", ("party", "sequin", "cocktail", "bodycon", "stiletto", "heel")),
    ("boho", ("boho", "maxi", "kaftan", "tassel", "peasant")),
    ("old-money", ("linen", "loafer", "cashmere", "tweed", "pearl", "trench")),
    ("formal", ("formal", "blazer", "tuxedo", "office", "waistcoat")),
    ("vintage", ("vintage", "retro", "denim jacket", "corduroy", "fedora")),
    ("smart-casual", ("chino", "polo", "oxford")),
    ("minimalist", ("solid ", "plain ")),
    ("aesthetic", ("floral", "pastel", "blouse")),
]


def load_old():
    spec = importlib.util.spec_from_file_location("stallcat", Path(__file__).with_name("build-stall-catalog.py"))
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def kid(title: str) -> bool:
    text = f" {title.lower()} "
    return any(word in text for word in (" boy ", " boys ", " girl ", " girls ", " kid ", " kids ", " infant ", " toddler ", " baby "))


def style_of(title: str, hint: str) -> str:
    if hint in STYLES:
        return hint
    text = title.lower()
    for style, words in KEYWORDS:
        if any(word in text for word in words):
            return style
    return "casual"


def image_size(raw: bytes) -> tuple[int, int] | None:
    if raw[:2] == b"\xff\xd8":
        index = 2
        while index < len(raw) - 9:
            if raw[index] != 0xFF:
                index += 1
                continue
            marker = raw[index + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                height = int.from_bytes(raw[index + 5 : index + 7], "big")
                width = int.from_bytes(raw[index + 7 : index + 9], "big")
                return width, height
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                index += 2
                continue
            length = int.from_bytes(raw[index + 2 : index + 4], "big")
            if length < 2:
                break
            index += 2 + length
    if raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) > 24:
        return int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big")
    return None


def bigger(url: str) -> str:
    import re

    return re.sub(r"h_\d+,q_\d+,w_\d+", "h_1440,q_90,w_1080", url)


def folder_for(item: dict) -> list[str] | None:
    if item["category"] == "accessories":
        acc = item.get("accessoryType")
        return FOLDERS.get(acc) if acc else None
    return FOLDERS.get(item["category"])


def pick(items: list[dict], cap: int) -> list[dict]:
    buckets: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for item in items:
        buckets[(item["style"], item.get("gender") or "unknown")].append(item)
    keys = list(buckets)
    chosen: list[dict] = []
    cursor = 0
    guard = 0
    while len(chosen) < cap and keys:
        key = keys[cursor % len(keys)]
        if buckets[key]:
            chosen.append(buckets[key].pop(0))
        else:
            keys.remove(key)
            if not keys:
                break
            cursor += 1
            continue
        cursor += 1
        guard += 1
        if guard > cap * 20:
            break
    return chosen


def template(dir_path: Path) -> None:
    payload = {
        "id": "example-id",
        "title": "Product title",
        "brand": "Brand",
        "priceInr": 1999,
        "mrpInr": 3999,
        "url": "https://www.myntra.com/product/example/buy",
        "image": "your-photo.jpg",
        "store": "myntra",
        "gender": "women",
        "style": "casual",
        "color": "Black",
    }
    (dir_path / "_template.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    old = load_old()
    found: list[dict] = []
    if OLD_JSON.exists():
        previous = json.loads(OLD_JSON.read_text(encoding="utf-8"))
        for item in previous.get("items", []):
            title = item.get("title") or ""
            if kid(title):
                continue
            category = "bottoms" if item.get("category") == "pants" else item.get("category")
            if category not in CAPS:
                continue
            local = OLD_IMG / f"{item['id']}.jpg"
            if not local.exists():
                continue
            row = dict(item)
            row["category"] = category
            row["style"] = style_of(title, "")
            row["local"] = str(local)
            if category == "accessories" and not row.get("accessoryType"):
                continue
            found.append(row)
        print(f"kept {len(found)} existing adult products")

    def one(entry):
        category, url, hint, style, gender = entry
        print(f"lookup {category} {style} {url}", flush=True)
        best = old.cdx_best(url)
        if not best:
            print(f"  no snapshot {url}")
            return []
        ts, original = best
        try:
            html = old.snapshot_html(ts, original)
        except Exception as exc:
            print(f"  snapshot fail {url}: {exc}")
            return []
        parser = old.amazon_products if "amazon.in" in url else old.myntra_products
        items = parser(html, category, hint, ts)
        kept = []
        for item in items:
            if kid(item["title"]):
                continue
            item["style"] = style_of(item["title"], style)
            if gender and item.get("gender") in (None, "unknown"):
                item["gender"] = gender
            item["imageUrl"] = bigger(item.get("imageUrl") or "")
            kept.append(item)
        print(f"  {len(kept)} from {url}")
        return kept

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(one, entry) for entry in PAGES]
        for fut in as_completed(futures):
            found.extend(fut.result())

    dedup = {}
    for item in found:
        dedup.setdefault(item["id"], item)
    items = [item for item in dedup.values() if folder_for(item)]
    print(f"unique candidates {len(items)}")

    by_cat: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        by_cat[item["category"]].append(item)

    selected: list[dict] = []
    for category, cap in CAPS.items():
        pool = by_cat[category]
        if category == "accessories":
            typed: dict[str, list[dict]] = defaultdict(list)
            for item in pool:
                typed[item["accessoryType"]].append(item)
            chunk: list[dict] = []
            for acc, rows in typed.items():
                chunk.extend(pick(rows, ACC_CAP))
            if len(chunk) < cap:
                used = {item["id"] for item in chunk}
                rest = [item for item in pool if item["id"] not in used]
                chunk.extend(pick(rest, cap - len(chunk)))
            selected.extend(chunk[:cap])
        else:
            selected.extend(pick(pool, cap))
    print(f"selected {len(selected)} before downloads")

    def materialise(item: dict) -> dict | None:
        folder = folder_for(item)
        if not folder:
            return None
        dest_dir = OUT.joinpath(*folder)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{item['id']}.jpg"
        if item.get("local") and Path(item["local"]).exists() and not dest.exists():
            shutil.copy2(item["local"], dest)
        elif item.get("imageUrl") and (not dest.exists() or dest.stat().st_size < 8000):
            try:
                raw = old.fetch(item["imageUrl"], timeout=25)
            except Exception as exc:
                print(f"  img fail {item['id']}: {exc}")
                return None
            size = image_size(raw)
            if raw[:3] != b"\xff\xd8\xff" or len(raw) < 12000 or not size or min(size) < 360:
                print(f"  low quality {item['id']} {size} {len(raw)}")
                return None
            dest.write_bytes(raw)
        if not dest.exists() or dest.stat().st_size < 8000:
            return None
        row = {
            "id": item["id"],
            "title": item["title"],
            "brand": item.get("brand") or "",
            "priceInr": item["priceInr"],
            "mrpInr": item.get("mrpInr"),
            "url": item["url"],
            "image": dest.name,
            "store": item["store"],
            "gender": item.get("gender") or "unknown",
            "style": item["style"] if item["style"] in STYLES else "casual",
            "color": item.get("color"),
        }
        if item.get("capturedAt"):
            row["capturedAt"] = item["capturedAt"]
        row["_dir"] = str(dest_dir)
        return row

    saved = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(materialise, item) for item in selected]
        for fut in as_completed(futures):
            got = fut.result()
            if got:
                saved.append(got)

    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in saved:
        grouped[item.pop("_dir")].append(item)

    for folder in FOLDERS.values():
        dest = OUT.joinpath(*folder)
        dest.mkdir(parents=True, exist_ok=True)
        template(dest)

    for dest_dir, rows in grouped.items():
        rows.sort(key=lambda row: (row["style"], row["gender"], row["id"]))
        payload = {"items": rows}
        Path(dest_dir, "items.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        keep = {row["image"] for row in rows}
        for file in Path(dest_dir).glob("*"):
            if file.suffix.lower() == ".jpg" and file.name not in keep:
                file.unlink()

    if OLD_JSON.exists():
        OLD_JSON.unlink()
    if OLD_IMG.exists():
        shutil.rmtree(OLD_IMG)

    summary: dict[str, int] = {}
    styles: dict[str, int] = defaultdict(int)
    stores: dict[str, int] = defaultdict(int)
    for folder in FOLDERS.values():
        file = OUT.joinpath(*folder, "items.json")
        count = 0
        if file.exists():
            data = json.loads(file.read_text(encoding="utf-8"))
            count = len(data["items"])
            for row in data["items"]:
                styles[row["style"]] += 1
                stores[row["store"]] += 1
        summary["/".join(folder)] = count
    print(json.dumps({"folders": summary, "styles": styles, "stores": stores, "total": sum(summary.values())}, indent=2))


if __name__ == "__main__":
    main()

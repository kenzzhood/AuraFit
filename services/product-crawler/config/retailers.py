"""Retailer registry — loads sites.yaml and builds region-specific search URLs."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus

import yaml

_CONFIG_PATH = Path(__file__).resolve().parent / "sites.yaml"


@dataclass(frozen=True)
class RetailerConfig:
    key: str
    search_url_template: str
    regions: tuple[str, ...]
    priority: int
    engine: str  # playwright | httpx


def _slug_query(query: str) -> str:
    """Myntra uses slug-style paths: /blue-linen-dress."""
    slug = re.sub(r"[^a-z0-9]+", "-", query.lower().strip())
    return slug.strip("-") or quote_plus(query)


def _load_retailers() -> list[RetailerConfig]:
    raw = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    entries = raw.get("retailers") or {}
    out: list[RetailerConfig] = []
    for key, cfg in entries.items():
        if not isinstance(cfg, dict):
            continue
        if cfg.get("disabled"):
            continue
        template = str(cfg.get("search_url_template") or "").strip()
        if not template:
            continue
        regions = tuple(str(r).upper() for r in (cfg.get("regions") or ["IN"]))
        out.append(
            RetailerConfig(
                key=key,
                search_url_template=template,
                regions=regions,
                priority=int(cfg.get("priority") or 99),
                engine=str(cfg.get("engine") or "playwright"),
            )
        )
    out.sort(key=lambda r: r.priority)
    return out


_RETAILERS: list[RetailerConfig] | None = None


def get_retailers() -> list[RetailerConfig]:
    global _RETAILERS
    if _RETAILERS is None:
        _RETAILERS = _load_retailers()
    return _RETAILERS


def build_search_url(retailer: RetailerConfig, query: str) -> str:
    q = quote_plus(query)
    slug = _slug_query(query)
    return (
        retailer.search_url_template.replace("{query}", q).replace("{slug_query}", slug)
    )


def search_urls_for_region(query: str, region: str) -> list[tuple[RetailerConfig, str]]:
    """Return ordered (retailer, search_url) for the given query and region."""
    region = region.upper()
    out: list[tuple[RetailerConfig, str]] = []
    for r in get_retailers():
        if region not in r.regions:
            continue
        out.append((r, build_search_url(r, query)))
    return out

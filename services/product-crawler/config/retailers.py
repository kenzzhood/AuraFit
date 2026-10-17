"""Retailer registry — loads sites.yaml and builds region-specific search URLs."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus, urlparse

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


def _registrable_domain(host: str) -> str:
    return host.replace("www.", "").lower()


def _domain_from_template(template: str) -> str | None:
    try:
        sample = template.replace("{query}", "test").replace("{slug_query}", "test")
        host = urlparse(sample).hostname
        if not host:
            return None
        return _registrable_domain(host)
    except Exception:  # noqa: BLE001
        return None


def retailers_from_overrides(
    overrides: list[dict] | None,
    region: str,
) -> list[RetailerConfig]:
    """Build ad-hoc retailer configs from GPT / API overrides."""
    from validators.ssrf import UnsafeUrlError, assert_safe_crawl_url

    if not overrides:
        return []
    out: list[RetailerConfig] = []
    seen: set[str] = set()
    for i, raw in enumerate(overrides):
        if not isinstance(raw, dict):
            continue
        template = str(
            raw.get("search_url_template")
            or raw.get("searchUrlTemplate")
            or ""
        ).strip()
        if not template or ("{query}" not in template and "{slug_query}" not in template):
            continue
        if not template.startswith("https://"):
            continue
        sample = template.replace("{query}", "test").replace("{slug_query}", "test")
        try:
            assert_safe_crawl_url(sample)
        except UnsafeUrlError:
            continue
        domain = str(raw.get("domain") or "").strip().lower()
        if not domain:
            domain = _domain_from_template(template) or ""
        domain = _registrable_domain(domain)
        if not domain or domain in seen:
            continue
        template_host = _domain_from_template(template)
        if template_host and template_host != domain and not template_host.endswith(
            f".{domain}"
        ) and not domain.endswith(f".{template_host}"):
            continue
        seen.add(domain)
        name = str(raw.get("name") or domain.split(".")[0]).strip()
        engine = str(raw.get("engine") or "playwright").lower()
        if engine not in ("playwright", "httpx"):
            engine = "playwright"
        priority = int(raw.get("priority") or 10)
        key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or f"dyn_{i}"
        out.append(
            RetailerConfig(
                key=key[:40],
                search_url_template=template,
                regions=(region.upper(),),
                priority=max(1, min(priority, 99)),
                engine=engine,
            )
        )
    out.sort(key=lambda r: r.priority)
    return out


CORE_MARKETPLACE_DOMAINS = {
    "amazon.in",
    "amazon.com",
    "amazon.co.uk",
    "myntra.com",
    "ajio.com",
    "flipkart.com",
    "nykaafashion.com",
    "nykaa.com",
    "tatacliq.com",
    "meesho.com",
}

BOUTIQUE_DOMAINS = {"bananaclub.co.in", "snitch.co.in", "snitch.com"}


def retailer_domain(retailer: RetailerConfig) -> str:
    return _domain_from_template(retailer.search_url_template) or ""


def search_wave(retailer: RetailerConfig) -> int:
    """0 = marketplaces, 1 = brand stores, 2 = boutique last-resort."""
    domain = retailer_domain(retailer)
    if any(domain == d or domain.endswith(f".{d}") for d in BOUTIQUE_DOMAINS):
        return 2
    if any(domain == d or domain.endswith(f".{d}") for d in CORE_MARKETPLACE_DOMAINS):
        return 0
    return 1


def search_urls_for_region(
    query: str,
    region: str,
    site_overrides: list[dict] | None = None,
) -> list[tuple[RetailerConfig, str]]:
    """Return ordered (retailer, search_url) for the given query and region.

    Caller overrides (Amazon / Myntra / Ajio from the web app) win over the
    static YAML list. Boutique Shopify brands are always sorted last so they
    cannot fill the verified quota before marketplaces are searched.
    """
    region = region.upper()
    static: list[tuple[RetailerConfig, str]] = []
    for r in get_retailers():
        if region not in r.regions:
            continue
        static.append((r, build_search_url(r, query)))

    dynamic_cfgs = retailers_from_overrides(site_overrides, region)
    dynamic: list[tuple[RetailerConfig, str]] = [
        (r, build_search_url(r, query)) for r in dynamic_cfgs
    ]

    merged: list[tuple[RetailerConfig, str]] = []
    seen_domains: set[str] = set()

    def _add(retailer: RetailerConfig, url: str) -> None:
        domain = _domain_from_template(retailer.search_url_template)
        if not domain or domain in seen_domains:
            return
        seen_domains.add(domain)
        merged.append((retailer, url))

    # Web-sent marketplaces first, then the static catalog.
    for retailer, url in dynamic:
        _add(retailer, url)
    for retailer, url in static:
        _add(retailer, url)

    merged.sort(key=lambda pair: (search_wave(pair[0]), pair[0].priority, pair[0].key))
    return merged

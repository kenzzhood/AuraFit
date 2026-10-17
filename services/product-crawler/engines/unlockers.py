"""Optional paid unlockers (Bright Data Web Unlocker, Oxylabs). Skip when env is unset."""
from __future__ import annotations

import os

import httpx

from validators import ssrf as ssrf_mod

_BRIGHTDATA_URL = "https://api.brightdata.com/request"
_OXYLABS_URL = "https://realtime.oxylabs.io/v1/queries"


def _unlocker_timeout() -> float:
    return float(os.environ.get("FETCH_UNLOCKER_TIMEOUT_SEC", "20"))


async def fetch_via_brightdata(url: str) -> tuple[str, int | None]:
    """POST Bright Data Web Unlocker. Returns (html, status). Empty if token missing."""
    token = os.environ.get("BRIGHTDATA_API_TOKEN", "").strip()
    if not token:
        return "", None
    ssrf_mod.assert_safe_crawl_url(url)
    zone = os.environ.get("BRIGHTDATA_WEB_UNLOCKER_ZONE", "").strip() or "web_unlocker"
    async with httpx.AsyncClient(timeout=_unlocker_timeout()) as client:
        r = await client.post(
            _BRIGHTDATA_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"zone": zone, "url": url, "format": "raw"},
        )
        r.raise_for_status()
        return r.text or "", r.status_code


async def fetch_via_oxylabs(url: str) -> tuple[str, int | None]:
    """POST Oxylabs Realtime Universal. Returns (html, status). Empty if creds missing."""
    username = os.environ.get("OXYLABS_USERNAME", "").strip()
    password = os.environ.get("OXYLABS_PASSWORD", "").strip()
    if not username or not password:
        return "", None
    ssrf_mod.assert_safe_crawl_url(url)
    async with httpx.AsyncClient(timeout=_unlocker_timeout()) as client:
        r = await client.post(
            _OXYLABS_URL,
            auth=(username, password),
            json={"source": "universal", "url": url},
        )
        r.raise_for_status()
        data = r.json()
        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list) or not results:
            return "", r.status_code
        first = results[0] if isinstance(results[0], dict) else {}
        content = first.get("content") or ""
        status = first.get("status_code")
        if status is None:
            status = first.get("status")
        try:
            status_i = int(status) if status is not None else r.status_code
        except (TypeError, ValueError):
            status_i = r.status_code
        return str(content), status_i

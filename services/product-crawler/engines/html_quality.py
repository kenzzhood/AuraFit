"""Decide whether fetched HTML is a usable page vs a block/404 interstitial."""
from __future__ import annotations

import re

_BAD_STATUS = {401, 403, 404, 407, 410, 429, 503}

_UNUSABLE_BODY = re.compile(
    r"just a moment"
    r"|cf-browser-verification"
    r"|challenge-platform"
    r"|access denied"
    r"|page not found"
    r"|<title[^>]*>[^<]*404"
    r"|sorry, this page does not exist"
    r"|sorry, the page you were looking for"
    r"|we have moved to snitch\.com"
    r"|snitch\.co\.in is now"
    r"|can['’]?t find that",
    re.I,
)


def html_usable(html: str | None, status: int | None = None) -> bool:
    """False for empty/tiny bodies, HTTP error statuses, challenges, and 404 pages."""
    if status is not None:
        try:
            if int(status) in _BAD_STATUS:
                return False
        except (TypeError, ValueError):
            pass
    text = html or ""
    if len(text.strip()) < 400:
        return False
    if _UNUSABLE_BODY.search(text):
        return False
    return True

"""SSRF validation for crawler URL fetch endpoints."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

_BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata.google",
    "kubernetes.default.svc",
}


class UnsafeUrlError(ValueError):
    pass


def _hostname_blocked(hostname: str) -> bool:
    h = (hostname or "").lower().rstrip(".")
    if not h:
        return True
    if h in _BLOCKED_HOSTS:
        return True
    if h.endswith(".local") or h.endswith(".internal"):
        return True
    if h == "169.254.169.254":
        return True
    return False


def _ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def assert_safe_crawl_url(url: str) -> str:
    """Reject URLs that target private networks or cloud metadata."""
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("only http(s) URLs are allowed")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URLs with credentials are not allowed")
    host = parsed.hostname
    if not host:
        raise UnsafeUrlError("missing hostname")
    if _hostname_blocked(host):
        raise UnsafeUrlError("blocked hostname")

    # Resolve hostname and reject if any address is private.
    try:
        addr_infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as e:
        raise UnsafeUrlError(f"unresolvable host: {e}") from e

    for info in addr_infos:
        sockaddr = info[4]
        if not sockaddr:
            continue
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if _ip_blocked(ip):
            raise UnsafeUrlError("URL resolves to a private or reserved address")

    return url

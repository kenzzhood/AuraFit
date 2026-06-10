"""SSRF validator tests for crawler URL endpoints."""
from __future__ import annotations

import pytest

from validators.ssrf import UnsafeUrlError, assert_safe_crawl_url


def test_allows_public_https_url():
    # Uses a stable public host; resolution may vary by network.
    url = assert_safe_crawl_url("https://example.com/product/1")
    assert url.startswith("https://")


def test_blocks_localhost():
    with pytest.raises(UnsafeUrlError):
        assert_safe_crawl_url("http://localhost:8080/admin")


def test_blocks_metadata_ip():
    with pytest.raises(UnsafeUrlError):
        assert_safe_crawl_url("http://169.254.169.254/latest/meta-data/")


def test_blocks_private_ip_literal():
    with pytest.raises(UnsafeUrlError):
        assert_safe_crawl_url("http://127.0.0.1/internal")


def test_blocks_file_scheme():
    with pytest.raises(UnsafeUrlError):
        assert_safe_crawl_url("file:///etc/passwd")

"""HTML usability heuristics for challenge / blank / 404 pages."""
from __future__ import annotations

from engines.html_quality import html_usable


def _pad(body: str, n: int = 420) -> str:
    return body + (" x" * n)


def test_blank_and_tiny_html_unusable():
    assert html_usable(None) is False
    assert html_usable("") is False
    assert html_usable("   ") is False
    assert html_usable("<html><body>short</body></html>") is False


def test_error_status_unusable():
    ok = _pad("<html><body><h1>Real product listing</h1></body></html>")
    assert html_usable(ok, 200) is True
    for status in (401, 403, 404, 407, 410, 429, 503):
        assert html_usable(ok, status) is False


def test_cloudflare_challenge_unusable():
    assert html_usable(_pad("Just a moment... please wait")) is False
    assert html_usable(_pad('<div id="cf-browser-verification"></div>')) is False
    assert html_usable(_pad("cdn-cgi/challenge-platform/h/b/orchestrate")) is False
    assert html_usable(_pad("Access Denied")) is False


def test_404_fixtures_unusable():
    assert html_usable(_pad("<title>404 Not Found</title>")) is False
    assert html_usable(_pad("Page not found")) is False
    assert html_usable(_pad("Sorry, this page does not exist.")) is False
    assert html_usable(_pad("Sorry, the page you were looking for.")) is False


def test_snitch_moved_splash_unusable():
    assert html_usable(_pad("We have moved to snitch.com")) is False
    assert html_usable(_pad("snitch.co.in is now Snitch.com")) is False


def test_snitch_dead_pdp_shell_unusable():
    # snitch.com renders this empty shell for Shopify-era /products/ paths.
    assert html_usable(_pad("Oops! Can't Find That")) is False
    assert html_usable(_pad("Oops! Can\u2019t Find That")) is False
    assert html_usable(_pad("oops! cant find that")) is False
    assert html_usable(_pad("Can't Find That")) is False
    assert html_usable(_pad("cant find that")) is False
    assert html_usable(_pad("Can\u2019t Find That")) is False


def test_real_product_html_usable():
    html = _pad(
        "<html><head><title>Slim Fit Oxford Shirt</title></head>"
        "<body><h1>Slim Fit Oxford Shirt</h1><p>Buy now</p></body></html>"
    )
    assert html_usable(html, 200) is True

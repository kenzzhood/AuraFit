"""Google Shopping card URL rewrite — no live Google."""
from __future__ import annotations

from extractors.google_shopping import (
    parse_google_shopping_html,
    rewrite_google_card,
    unwrap_merchant_url,
)

NEW_SHAPE_PDP = (
    "https://www.snitch.com/men-shirts/"
    "regular-fit-black-shirt-4sfs145-02/9269896904866/buy"
)


def test_rewrite_google_card_drops_snitch_co_in_pdp():
    # Old .co.in Shopify handles cannot be mapped to the new snitch.com —
    # the card is dropped entirely instead of rewritten to a dead page.
    card = {
        "title": "Slim Fit Shirt",
        "url": "https://www.snitch.co.in/products/slim-fit-shirt",
        "image": "https://cdn.example/shirt.jpg",
        "verified": True,
    }
    assert rewrite_google_card(card) is None


def test_rewrite_google_card_keeps_new_shape_snitch_pdp():
    card = {
        "title": "Regular Fit Black Shirt",
        "url": NEW_SHAPE_PDP,
        "image": "https://cdn.example/shirt.jpg",
        "verified": True,
    }
    out = rewrite_google_card(card)
    assert out is not None
    assert out["url"] == NEW_SHAPE_PDP


def test_rewrite_google_card_drops_splash_and_dead_pdp_urls():
    splash = {
        "title": "Snitch",
        "url": "https://www.snitch.co.in/",
        "image": "https://cdn.example/x.jpg",
        "verified": True,
    }
    listing = {
        "title": "All products",
        "url": "https://www.snitch.com/products",
        "image": "https://cdn.example/x.jpg",
        "verified": True,
    }
    dead_pdp = {
        "title": "Slim Fit Shirt",
        "url": "https://www.snitch.com/products/slim-fit-shirt",
        "image": "https://cdn.example/x.jpg",
        "verified": True,
    }
    assert rewrite_google_card(splash) is None
    assert rewrite_google_card(listing) is None
    assert rewrite_google_card(dead_pdp) is None


def _q(url: str) -> str:
    return url.replace(":", "%3A").replace("/", "%2F")


def test_unwrap_merchant_url_rules():
    merchant = "https://www.myntra.com/dresses/floral-midi/123/buy"
    wrapped = "https://www.google.com/url?q=" + _q(merchant)
    assert unwrap_merchant_url(merchant) == merchant
    assert unwrap_merchant_url(wrapped) == merchant
    assert unwrap_merchant_url("/url?q=" + _q(merchant)) == merchant
    assert unwrap_merchant_url("https://www.google.com/url?q=" + _q(merchant).replace("%", "%25")) == merchant
    assert unwrap_merchant_url("not a url") is None
    assert unwrap_merchant_url("https://www.google.com/search?q=dress") is None

    dead = rewrite_google_card(
        {
            "title": "Old",
            "url": "https://www.google.com/url?q=" + _q("https://www.snitch.com/products/floral-midi"),
        }
    )
    assert dead is None
    assert (
        rewrite_google_card(
            {
                "title": "Old host",
                "url": "https://www.google.com/url?q=" + _q("https://www.snitch.co.in/products/old"),
            }
        )
        is None
    )
    live = rewrite_google_card(
        {"title": "Live", "url": "https://www.google.com/url?q=" + _q(NEW_SHAPE_PDP)}
    )
    assert live is not None
    assert live["url"] == NEW_SHAPE_PDP


def test_rewrite_google_card_keeps_non_snitch():
    card = {
        "title": "Oxford Shirt",
        "url": "https://www.amazon.in/dp/B0EXAMPLE1",
        "image": "https://cdn.example/x.jpg",
    }
    out = rewrite_google_card(card)
    assert out is not None
    assert out["url"] == "https://www.amazon.in/dp/B0EXAMPLE1"


def test_parse_google_shopping_html_drops_dead_snitch_keeps_live_pdp():
    html = f"""
    <html><body>
      <div class="sh-dgr__content">
        <h3>Slim Fit Shirt</h3>
        <a href="https://www.snitch.co.in/products/slim-fit-shirt">buy</a>
        <img src="https://cdn.example/shirt.jpg" />
      </div>
      <div class="sh-dgr__content">
        <h3>Regular Fit Black Shirt</h3>
        <a href="{NEW_SHAPE_PDP}">buy</a>
        <img src="https://cdn.example/black-shirt.jpg" />
      </div>
      <div class="sh-dgr__content">
        <h3>We moved splash</h3>
        <a href="https://www.snitch.co.in/">home</a>
        <img src="https://cdn.example/splash.jpg" />
      </div>
    </body></html>
    """
    products = parse_google_shopping_html(html, "IN", "top")
    urls = [p["url"] for p in products]
    assert NEW_SHAPE_PDP in urls
    assert not any("snitch.co.in" in u for u in urls)
    assert not any("/products" in u for u in urls)

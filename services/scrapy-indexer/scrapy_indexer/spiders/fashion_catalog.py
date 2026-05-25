"""Example catalog spider — extend with real retailer sitemaps."""
import scrapy


class FashionCatalogSpider(scrapy.Spider):
    name = "fashion_catalog"
    allowed_domains = ["example.com"]
    start_urls = ["https://www.example.com/"]

    custom_settings = {
        "FEEDS": {
            "out/products.jsonl": {"format": "jsonlines"},
        },
    }

    def parse(self, response):
        # Stub: replace with real PDP/listing parsers per retailer
        for card in response.css("a.product-link"):
            yield {
                "title": card.css("::text").get(),
                "url": response.urljoin(card.attrib.get("href", "")),
                "source": "scrapy",
                "region": "IN",
            }

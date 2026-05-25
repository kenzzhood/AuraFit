BOT_NAME = "aurafit_indexer"
SPIDER_MODULES = ["scrapy_indexer.spiders"]
NEWSPIDER_MODULE = "scrapy_indexer.spiders"
ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 4
DOWNLOAD_DELAY = 1
DEFAULT_REQUEST_HEADERS = {
    "User-Agent": "AurafitIndexer/1.0 (+https://aurafit.app)",
}

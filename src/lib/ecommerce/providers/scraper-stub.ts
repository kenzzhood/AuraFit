import type { ProductSearchProvider } from "./types";

/**
 * Placeholder for future Playwright/Puppeteer/Crawlee integrations.
 * Fails gracefully — never throws to the caller.
 */
export const scraperStubProductProvider: ProductSearchProvider = {
  name: "scraper",
  isConfigured: () => false,
  async search() {
    console.info(
      "[scraper-stub] Browser scraping not enabled. Set SCRAPER_ENABLED=true when implemented."
    );
    return [];
  },
};

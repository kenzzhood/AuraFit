import type {
  NormalizedProduct,
  ProductQuery,
  ProductSearchProvider,
  ProductSource,
} from "./types";

/**
 * Self-hosted verified-product provider.
 *
 * Talks to our own Python crawler (`services/product-crawler/main.py`):
 *
 *   1. The crawler first tries real Google Shopping (`udm=28`). When Google
 *      doesn't bot-block the request (rare from cloud IPs) we get cards back
 *      in <1 s with merchant URLs + thumbnails.
 *   2. Otherwise it falls through to retailer search (Flipkart + Amazon.in
 *      via Playwright) with per-detail-page validation. Every returned row
 *      is a real, in-stock product from the retailer's own search results.
 *
 * Either path returns:
 *   - a real merchant URL (Flipkart/Amazon.in/Myntra/Ajio/Nykaa/…)
 *   - an `imageUrl` we can feed into `gpt-image-2.edit()` as a reference
 *   - `verified: true`
 *   - `matchCategory` so the UI/prompt can slot it into outerwear/top/…
 *
 * No external API keys, no SaaS subscription, fully open source
 * (Crawl4AI + Playwright + httpx + lxml).
 */

const CRAWLER_URL = () =>
  process.env.PRODUCT_CRAWLER_URL ?? "http://localhost:8100";
const CRAWLER_KEY = () => process.env.CRAWLER_API_KEY ?? "";

function inferSourceFromHost(url?: string): ProductSource | string {
  if (!url) return "google_shopping";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon")) return "amazon";
    if (host.includes("flipkart")) return "flipkart";
    if (host.includes("myntra")) return "myntra";
    return host.replace(/^www\./, "");
  } catch {
    return "google_shopping";
  }
}

export const googleShoppingProductProvider: ProductSearchProvider = {
  name: "google-shopping",
  isConfigured: () => !!process.env.PRODUCT_CRAWLER_URL,
  async search(q: ProductQuery): Promise<NormalizedProduct[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const key = CRAWLER_KEY();
    if (key) headers["X-Crawler-Key"] = key;

    let res: Response;
    try {
      // The endpoint tries Google Shopping first (~1 s when not blocked) and
      // falls back to Flipkart/Amazon retailer search with per-detail-page
      // validation. We cap at 12 s — enough for the fast Google Shopping path
      // and short Playwright runs, but tight enough that a wedged crawler
      // doesn't burn 60 s × N slots in the synchronous generation path.
      res = await fetch(`${CRAWLER_URL()}/crawl/google-shopping`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: q.query,
          region: q.region,
          category: q.category,
          budget_min: q.budgetMin,
          budget_max: q.budgetMax,
          // Generation only needs the first verified match per item slot.
          // Validating fewer detail pages is the single biggest lever on
          // crawler latency when Playwright is engaged.
          max_results: 2,
        }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch (e) {
      console.warn("google-shopping fetch failed:", e);
      return [];
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "google-shopping non-2xx:",
        res.status,
        text.slice(0, 200)
      );
      return [];
    }

    const data = (await res.json()) as {
      products?: Array<{
        title?: string;
        url?: string;
        image?: string;
        price?: number | null;
        currency?: string;
        storeName?: string;
        source?: string;
        rating?: number | null;
        verified?: boolean;
        availability?: string;
        matchCategory?: string;
      }>;
    };

    const rows = data.products ?? [];
    return rows
      .filter((r) => r.title && r.url && r.image)
      .slice(0, 6)
      .map((r, i) => {
        const source = (r.source as ProductSource | undefined) ??
          (inferSourceFromHost(r.url) as ProductSource | string);
        const id = `${encodeURIComponent(r.title!.slice(0, 40))}-${i}`.slice(
          0,
          80
        );
        return {
          externalId: id,
          source: source as ProductSource | string,
          title: r.title!,
          price: r.price ?? undefined,
          currency:
            r.currency ??
            (q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR"),
          imageUrl: r.image!,
          productUrl: r.url!,
          category: r.matchCategory ?? q.category,
          storeName: r.storeName,
          verified: r.verified !== false,
          availability:
            r.availability === "out_of_stock"
              ? "out_of_stock"
              : r.availability === "in_stock"
                ? "in_stock"
                : "unknown",
          matchCategory: r.matchCategory ?? q.category,
        };
      });
  },
};

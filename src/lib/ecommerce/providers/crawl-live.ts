import { normalizeProduct, normalizeProductBatch } from "@/lib/ecommerce/normalize";
import type { Product } from "@/lib/ecommerce/product";
import type { ProductQuery, ProductSearchProvider } from "./types";

const CRAWLER_URL = () =>
  process.env.PRODUCT_CRAWLER_URL ?? "http://localhost:8100";
const CRAWLER_KEY = () => process.env.CRAWLER_API_KEY ?? "";

export const crawlLiveProductProvider: ProductSearchProvider = {
  name: "crawl",
  isConfigured: () => !!process.env.PRODUCT_CRAWLER_URL,
  async search(q: ProductQuery): Promise<import("./types").NormalizedProduct[]> {
    const products = await crawlProductsLive(q);
    return products.map((p) => ({
      externalId: p.externalId,
      source: p.source,
      title: p.title,
      price: p.price,
      currency: p.currency,
      imageUrl: p.image,
      productUrl: p.url,
      category: p.category,
      storeName: p.storeName ?? p.brand,
      verified: p.verified,
      canonicalUrl: p.canonicalUrl,
      availability: p.availability,
      matchCategory: p.matchCategory,
      matchConfidence: p.matchConfidence,
    }));
  },
};

/** Called from background jobs only — may take 30–120s. */
export async function crawlProductsLive(
  q: ProductQuery,
  options?: { maxResults?: number }
): Promise<Product[]> {
  const maxResults = options?.maxResults ?? 3;
  const url = `${CRAWLER_URL()}/crawl/search`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = CRAWLER_KEY();
  if (key) headers["X-Crawler-Key"] = key;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: q.query,
        region: q.region,
        category: q.category,
        budget_min: q.budgetMin,
        budget_max: q.budgetMax,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Crawler failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    products?: Record<string, unknown>[];
  };
  const items = data.products ?? [];
  return normalizeProductBatch(items, "crawl", {
    region: q.region,
    currency: q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
  });
}

/**
 * Validate (or fail) one candidate URL against the crawler's verifier.
 *
 * Returns the verified Product on success or null when the page failed
 * validation (wrong host, missing image, captcha, etc.). Use this when you
 * already have a candidate URL and just need to confirm it's real before
 * showing it to a user or feeding its image into image-gen.
 */
export async function resolveProductUrl(input: {
  url: string;
  region: "IN" | "US" | "UK";
  category?: string;
}): Promise<Product | null> {
  const url = `${CRAWLER_URL()}/crawl/resolve`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = CRAWLER_KEY();
  if (key) headers["X-Crawler-Key"] = key;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ url: input.url }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    verified?: boolean;
    product?: Record<string, unknown> | null;
  };
  if (!data.verified || !data.product) return null;
  const product = normalizeProduct(
    { ...data.product, category: input.category ?? data.product.category },
    "crawl",
    {
      region: input.region,
      currency:
        input.region === "US" ? "USD" : input.region === "UK" ? "GBP" : "INR",
    }
  );
  return product;
}

export async function checkCrawlerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${CRAWLER_URL()}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

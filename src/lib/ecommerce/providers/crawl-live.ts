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
export async function crawlProductsLive(q: ProductQuery): Promise<Product[]> {
  const url = `${CRAWLER_URL()}/crawl/search`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = CRAWLER_KEY();
  if (key) headers["X-Crawler-Key"] = key;

  const startedAt = Date.now();
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
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9cb59e' },
        body: JSON.stringify({
          sessionId: '9cb59e',
          hypothesisId: 'H1,H3',
          location: 'crawl-live.ts:fetch-error',
          message: 'crawler-fetch-threw',
          data: {
            query: q.query.slice(0, 80),
            category: q.category,
            elapsedMs: Date.now() - startedAt,
            error: e instanceof Error ? e.message : String(e),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // #endregion
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    // #region agent log
    try {
      fetch('http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9cb59e' },
        body: JSON.stringify({
          sessionId: '9cb59e',
          hypothesisId: 'H1',
          location: 'crawl-live.ts:non-2xx',
          message: 'crawler-non-2xx',
          data: { status: res.status, body: text.slice(0, 300), elapsedMs: Date.now() - startedAt },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {}
    // #endregion
    throw new Error(`Crawler failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    products?: Record<string, unknown>[];
    count?: number;
    candidateCount?: number;
    rejected?: { url: string; reason: string }[];
  };
  const items = data.products ?? [];
  // #region agent log
  try {
    fetch('http://127.0.0.1:7717/ingest/8a77d6d8-834f-4f42-ac01-0cc8761305b6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9cb59e' },
      body: JSON.stringify({
        sessionId: '9cb59e',
        hypothesisId: 'H1,H2,H3',
        location: 'crawl-live.ts:response-parsed',
        message: 'crawler-response',
        data: {
          query: q.query.slice(0, 80),
          category: q.category,
          status: res.status,
          elapsedMs: Date.now() - startedAt,
          verifiedCount: items.length,
          candidateCount: data.candidateCount,
          rejectedCount: data.rejected?.length ?? 0,
          rejectedSample: (data.rejected ?? []).slice(0, 4),
          sample: items.slice(0, 2).map((it) => ({
            title: typeof it.title === 'string' ? it.title.slice(0, 60) : null,
            verified: it.verified,
            source: it.source,
            hasImage: !!(it.image ?? it.imageUrl),
            url: typeof it.url === 'string' ? it.url.slice(0, 120) : null,
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {}
  // #endregion
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

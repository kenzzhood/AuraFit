import { parseProviderOrder } from "@/lib/providers/env";
import { mergeProviderMeta } from "@/lib/providers/fallback";
import type { ProviderMeta } from "@/lib/providers/types";
import type { ProductQuery } from "./providers/types";
import type { Product } from "./product";
import { productToNormalized, normalizedToProduct } from "./product";
import { getCachedProducts, setCachedProducts } from "./cache";
import { searchProductIndex } from "./index/search";
import { upsertProductIndexBatch } from "./index/persist";
import { rankProductList, type RankingContext } from "./ranking";
import { dedupeProducts } from "./dedupe";
import {
  createProductSearchSession,
  updateProductSearchSession,
  type SessionStatus,
} from "./session";
import { serpApiProductProvider } from "./providers/serpapi";
import { googleShoppingProductProvider } from "./providers/google-shopping";
import { demoProductProvider } from "./providers/demo";
import { enqueueProductCrawl } from "./crawl-queue";
import type { PersonAnalysis, PlannedLook } from "@/types/generation";

export type DiscoverProductsResult = {
  products: Product[];
  sessionId?: string;
  status: SessionStatus;
  providerMeta: ProviderMeta;
  /**
   * False when the results came (entirely or partly) from the demo
   * placeholder provider — i.e. products are NOT shoppable in any real store.
   * Callers that show product links to end users should filter these out.
   */
  availableOnly: boolean;
};

function getDiscoveryLayers(): string[] {
  // Default order:
  //   1. cache   — local per-process cache (instant)
  //   2. shopping — live Google Shopping via Serper/SerpAPI (≈1 s, verified)
  //   3. index   — pgvector store of products seen on previous runs
  //   4. crawl   — slow Playwright validator pipeline, kept for batch backfill
  //
  // Note: `crawl` is OFF by default because each Flipkart/Amazon detail page
  // takes 30–120 s in Playwright. Use it only when running a deliberate
  // backfill job, never in the synchronous generation critical path.
  return parseProviderOrder("PRODUCT_DISCOVERY_LAYERS", [
    "cache",
    "shopping",
    "index",
  ]);
}

/**
 * Map an arbitrary user-supplied location string (city, country, etc.) to the
 * subset of regions our product providers actually understand. Falls back to
 * "IN" because that's our launch market. Keep matching cheap and forgiving —
 * users type free-text like "Mumbai", "Bengaluru", "London, UK", etc.
 */
export function locationToRegion(
  location?: string | null
): "IN" | "US" | "UK" {
  if (!location) return "IN";
  const s = location.toLowerCase();

  // UK
  if (
    /\b(uk|united kingdom|england|scotland|wales|london|manchester|birmingham|edinburgh|glasgow|liverpool|leeds|bristol|sheffield)\b/.test(
      s
    )
  ) {
    return "UK";
  }

  // US
  if (
    /\b(us|usa|united states|america|new york|nyc|los angeles|la|san francisco|sf|chicago|seattle|boston|miami|austin|dallas|houston|atlanta|denver|portland|washington dc|dc)\b/.test(
      s
    )
  ) {
    return "US";
  }

  // Default to India — explicit Indian markers also land here
  return "IN";
}

const minResults = () =>
  Number(process.env.PRODUCT_CRAWL_MIN_RESULTS ?? 4);

/**
 * Synchronous live shopping search.
 *
 * Primary:   self-hosted Google Shopping (our Python crawler hitting
 *            `google.com/search?tbm=shop&gl=<region>` directly — no keys, ≈1 s).
 * Optional:  paid SerpAPI fallback when the self-hosted path returns empty
 *            (e.g. CAPTCHA, rate-limit). Only used if `SERPAPI_KEY` is set.
 *
 * Both backends return verified products with `imageUrl` (used as an image-gen
 * ingredient) and a real merchant URL (used as the "Shop this look" link).
 */
async function fetchShoppingProviders(
  q: ProductQuery
): Promise<{ products: Product[]; meta: ProviderMeta }> {
  const failures: ProviderMeta["failures"] = [];
  const providersUsed: string[] = [];

  // Primary: self-hosted Google Shopping via our crawler container.
  if (googleShoppingProductProvider.isConfigured()) {
    try {
      const raw = await googleShoppingProductProvider.search(q);
      if (raw.length) {
        providersUsed.push("google-shopping");
        return {
          products: dedupeProducts(raw.map((p) => normalizedToProduct(p))),
          meta: { providersUsed },
        };
      }
    } catch (e) {
      failures.push({
        system: "product_search",
        provider: "google-shopping",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Optional: paid SerpAPI fallback if a key is configured.
  if (serpApiProductProvider.isConfigured()) {
    try {
      const raw = await serpApiProductProvider.search(q);
      if (raw.length) {
        providersUsed.push("serpapi");
        return {
          products: dedupeProducts(raw.map((p) => normalizedToProduct(p))),
          meta: { providersUsed },
        };
      }
    } catch (e) {
      failures.push({
        system: "product_search",
        provider: "serpapi",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    products: [],
    meta: {
      degraded: failures.length > 0,
      failures: failures.length ? failures : undefined,
      providersUsed,
    },
  };
}

/**
 * Legacy demo provider — never used in the default chain. Kept only for
 * tests/dev environments that explicitly opt in via `PRODUCT_DISCOVERY_LAYERS`.
 */
async function fetchDemoProvider(
  q: ProductQuery
): Promise<{ products: Product[]; meta: ProviderMeta }> {
  const raw = await demoProductProvider.search(q);
  return {
    products: dedupeProducts(raw.map((p) => normalizedToProduct(p))),
    meta: { providersUsed: ["demo"] },
  };
}

export async function discoverProducts(params: {
  query: ProductQuery;
  userId?: string;
  generationJobId?: string;
  rankingContext?: RankingContext;
  /** When true, enqueue background crawl without awaiting */
  allowAsyncCrawl?: boolean;
}): Promise<DiscoverProductsResult> {
  const q = params.query;
  const layers = getDiscoveryLayers();
  const providerMeta: ProviderMeta = { providersUsed: [] };
  let products: Product[] = [];
  let status: SessionStatus = "partial";

  // Layer 1: per-process cache (instant)
  if (layers.includes("cache")) {
    const cached = await getCachedProducts(q);
    if (cached?.length) {
      products = cached.map((p) => normalizedToProduct(p));
      providerMeta.providersUsed!.push("cache");
      status = products.length >= minResults() ? "ready" : "partial";
    }
  }

  // Layer 2: live Google Shopping (Serper → SerpAPI). This is the primary
  // synchronous source: each call costs ≈1–3 s and returns verified products
  // (real merchant pages with real images) that we can immediately feed into
  // image-gen and surface as "Shop this look".
  if (products.length < minResults() && layers.includes("shopping")) {
    const startedAt = Date.now();
    const live = await fetchShoppingProviders(q);

    if (live.products.length) {
      products = dedupeProducts([...products, ...live.products]);
      providerMeta.providersUsed = [
        ...(providerMeta.providersUsed ?? []),
        ...(live.meta.providersUsed ?? []),
      ];
      if (live.meta.degraded) providerMeta.degraded = true;
      if (live.meta.failures) {
        providerMeta.failures = [
          ...(providerMeta.failures ?? []),
          ...live.meta.failures,
        ];
      }
      if (products.length >= minResults()) status = "ready";
    }
  }

  // Layer 3: pgvector index (products we've seen on previous generations).
  if (products.length < minResults() && layers.includes("index")) {
    try {
      const indexed = await searchProductIndex(q, { limit: 12 });
      products = dedupeProducts([...products, ...indexed]);
      if (indexed.length) providerMeta.providersUsed!.push("index");
      if (products.length >= minResults()) status = "ready";
    } catch (e) {
      providerMeta.degraded = true;
      providerMeta.failures = [
        ...(providerMeta.failures ?? []),
        {
          system: "product_search",
          provider: "index",
          message: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  }

  // Layer 4: demo provider — only when explicitly opted into via
  // PRODUCT_DISCOVERY_LAYERS=…,demo. Never reached by default.
  if (products.length < minResults() && layers.includes("demo")) {
    const demo = await fetchDemoProvider(q);
    products = dedupeProducts([...products, ...demo.products]);
    providerMeta.providersUsed = [
      ...(providerMeta.providersUsed ?? []),
      ...(demo.meta.providersUsed ?? []),
    ];
  }

  // Rank before session/cache write
  if (params.rankingContext || products.length) {
    products = await rankProductList(products, {
      query: q,
      personAnalysis: params.rankingContext?.personAnalysis,
      plannedLook: params.rankingContext?.plannedLook,
    });
  }

  const sessionId = await createProductSearchSession({
    userId: params.userId,
    generationJobId: params.generationJobId,
    query: q,
    products,
    status,
    providerMeta,
  });



  // Layer 5: async Playwright crawl (slow, opt-in only). Useful for batch
  // backfill against Flipkart/Amazon detail pages; not on the synchronous
  // generation path because each call can take 30–120 s.
  if (
    params.allowAsyncCrawl !== false &&
    layers.includes("crawl") &&
    products.length < minResults() &&
    process.env.PRODUCT_CRAWLER_URL
  ) {
    try {
      await enqueueProductCrawl({
        sessionId,
        query: q,
        userId: params.userId,
        generationJobId: params.generationJobId,
        rankingContext: params.rankingContext,
      });
      providerMeta.providersUsed!.push("crawl-queued");
    } catch (e) {
      providerMeta.degraded = true;
      providerMeta.failures = [
        ...(providerMeta.failures ?? []),
        {
          system: "product_search",
          provider: "crawl",
          message: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  } else if (products.length >= minResults()) {
    status = "ready";
    await updateProductSearchSession(sessionId, { status: "ready" });
  }

  // Persist to cache + index
  if (products.length) {
    await setCachedProducts(q, products.map((p) => productToNormalized(p)));
    if (layers.includes("index")) {
      upsertProductIndexBatch(products, { embed: true }).catch((e) =>
        console.warn("Index upsert failed:", e)
      );
    }
  }

  const usedDemo = (providerMeta.providersUsed ?? []).includes("demo");

  return {
    products,
    sessionId,
    status,
    providerMeta: mergeProviderMeta(providerMeta),
    availableOnly: !usedDemo,
  };
}

/** Backward-compatible sync search for simple callers */
export async function searchProducts(q: ProductQuery): Promise<
  import("./providers/types").NormalizedProduct[]
> {
  const { products } = await discoverProducts({ query: q });
  return products.map((p) => productToNormalized(p));
}

export async function searchProductsWithMeta(q: ProductQuery) {
  const result = await discoverProducts({ query: q });
  return {
    products: result.products.map((p) => productToNormalized(p)),
    meta: result.providerMeta,
    sessionId: result.sessionId,
    status: result.status,
  };
}

export type { ProductQuery } from "./providers/types";
export type { RankingContext } from "./ranking";

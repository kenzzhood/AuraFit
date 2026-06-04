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
import { crawlLiveProductProvider } from "./providers/crawl-live";
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
  // Default order (self-hosted fashion index):
  //   1. cache  — per-process / Redis cache (instant)
  //   2. index  — owned pgvector catalog (fast, free, grows nightly)
  //   3. crawl  — async Playwright backfill when index is sparse (non-blocking)
  //
  // Opt-in layers (set PRODUCT_DISCOVERY_LAYERS explicitly):
  //   shopping — paid SerpAPI / Google Shopping (emergency fallback only)
  //   demo     — placeholder products for dev/tests
  return parseProviderOrder("PRODUCT_DISCOVERY_LAYERS", [
    "cache",
    "index",
    "crawl",
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
 * Domains that have been confirmed to produce blank/broken pages for real
 * users even when our crawler validates them as "verified". Products from
 * these domains are filtered out at the discovery layer so they never reach
 * the generation result — regardless of which layer (cache/index/crawl)
 * surfaced them.
 *
 * Add domains here whenever a retailer is disabled in sites.yaml until we
 * can verify that the crawled URLs work reliably for real users.
 */
const BLOCKED_PRODUCT_DOMAINS = new Set([
  "snitch.co.in", // Men's-only brand; Playwright validation passes but pages render blank for real users
]);

function isFromBlockedDomain(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_PRODUCT_DOMAINS.has(host);
  } catch {
    return false;
  }
}

function filterBlockedDomains(products: Product[]): Product[] {
  return products.filter((p) => !isFromBlockedDomain(p.url));
}

function hasVerifiedShoppableProduct(products: Product[]): boolean {
  return products.some(
    (p) =>
      p.verified === true &&
      !!p.url &&
      !!p.image &&
      p.availability !== "out_of_stock"
  );
}

/**
 * Opt-in emergency shopping search (SerpAPI / Google Shopping).
 *
 * NOT used in the default discovery chain. Enable by setting
 * PRODUCT_DISCOVERY_LAYERS=cache,shopping,index,crawl and SERPAPI_KEY.
 *
 * Both backends return verified products with `imageUrl` and merchant URL.
 */
async function fetchShoppingProviders(
  q: ProductQuery
): Promise<{ products: Product[]; meta: ProviderMeta }> {
  const failures: ProviderMeta["failures"] = [];
  const providersUsed: string[] = [];

  // Primary: SerpAPI Google Shopping — broad, fast, parallel-safe.
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

  // Fallback: self-hosted Google Shopping via our crawler container.
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
  /**
   * Generation critical path: if shopping returns empty, run sync Playwright
   * crawl (scrapes retailer PDPs for real images + verified links).
   */
  syncCrawlFallback?: boolean;
  /** Skip google-shopping; go straight to sync Playwright (recovery path). */
  syncCrawlOnly?: boolean;
}): Promise<DiscoverProductsResult> {
  const q = params.query;
  const layers = getDiscoveryLayers();
  const providerMeta: ProviderMeta = { providersUsed: [] };
  let products: Product[] = [];
  let status: SessionStatus = "partial";

  // Layer 1: per-process cache (instant)
  if (!params.syncCrawlOnly && layers.includes("cache")) {
    const cached = await getCachedProducts(q);
    if (cached?.length) {
      products = filterBlockedDomains(cached.map((p) => normalizedToProduct(p)));
      if (products.length) providerMeta.providersUsed!.push("cache");
      status = products.length >= minResults() ? "ready" : "partial";
    }
  }

  // Layer 2: owned pgvector fashion index (primary synchronous source).
  if (!params.syncCrawlOnly && products.length < minResults() && layers.includes("index")) {
    try {
      const indexed = await searchProductIndex(q, { limit: 12 });
      products = dedupeProducts([...products, ...filterBlockedDomains(indexed)]);
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

  // Layer 3 (opt-in): paid SerpAPI / Google Shopping — only when `shopping`
  // is explicitly included in PRODUCT_DISCOVERY_LAYERS.
  if (
    !params.syncCrawlOnly &&
    products.length < minResults() &&
    layers.includes("shopping")
  ) {
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

  // Layer 3b: sync Playwright crawl — recovery path when index + cache empty.
  if (
    crawlLiveProductProvider.isConfigured() &&
    (params.syncCrawlOnly ||
      (params.syncCrawlFallback && !hasVerifiedShoppableProduct(products)))
  ) {
    try {
      const crawled = await crawlLiveProductProvider.search(q);
      if (crawled.length) {
        products = dedupeProducts([
          ...products,
          ...filterBlockedDomains(crawled.map((p) => normalizedToProduct(p))),
        ]);
        providerMeta.providersUsed = [
          ...(providerMeta.providersUsed ?? []),
          "crawl-sync",
        ];
        status = "ready";
      }
    } catch (e) {
      providerMeta.degraded = true;
      providerMeta.failures = [
        ...(providerMeta.failures ?? []),
        {
          system: "product_search",
          provider: "crawl-sync",
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

  let sessionId: string | undefined;
  try {
    sessionId = await createProductSearchSession({
      userId: params.userId,
      generationJobId: params.generationJobId,
      query: q,
      products,
      status,
      providerMeta,
    });
  } catch (e) {
    console.warn("createProductSearchSession failed:", e);
    providerMeta.degraded = true;
    providerMeta.failures = [
      ...(providerMeta.failures ?? []),
      {
        system: "product_search",
        provider: "session",
        message: e instanceof Error ? e.message : String(e),
      },
    ];
  }



  // Layer 5: async Playwright crawl — gap-fill when index is sparse.
  // Non-blocking: returns partial index results immediately; worker updates
  // the catalog for the next request.
  if (
    params.allowAsyncCrawl !== false &&
    layers.includes("crawl") &&
    products.length < minResults() &&
    process.env.PRODUCT_CRAWLER_URL &&
    sessionId
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
  } else if (products.length >= minResults() && sessionId) {
    status = "ready";
    await updateProductSearchSession(sessionId, { status: "ready" }).catch((e) =>
      console.warn("updateProductSearchSession failed:", e)
    );
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

/**
 * Bounded-concurrency parallel runner. Resolves `tasks` in order while never
 * having more than `limit` in flight. Failures resolve to the provided
 * `onError` fallback instead of rejecting the whole batch.
 */
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onError: (item: T, index: number, err: unknown) => R
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length || 1));

  async function pump(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = onError(items[i], i, err);
      }
    }
  }

  await Promise.all(Array.from({ length: size }, () => pump()));
  return results;
}

function discoveryConcurrency(): number {
  const n = Number(process.env.PRODUCT_DISCOVERY_CONCURRENCY ?? 8);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : 8;
}

export type BatchDiscoveryItem = {
  /** Stable key so callers can map results back (e.g. `${lookId}:${slot}`). */
  key: string;
  query: ProductQuery;
  rankingContext?: RankingContext;
};

export type BatchDiscoveryEntry = DiscoverProductsResult & { key: string };

/**
 * Run many product discoveries in parallel with a bounded pool.
 *
 * This is the core of the V2 pipeline: instead of awaiting each slot's search
 * sequentially (6 looks x 4 slots = 24 round-trips), we fire them all through a
 * concurrency-limited pool so a full 6-look package resolves in seconds.
 *
 * Every entry always resolves (failures degrade to an empty result for that
 * key) so one bad query never sinks the whole board.
 */
export async function discoverProductsBatch(
  items: BatchDiscoveryItem[],
  shared: {
    userId?: string;
    generationJobId?: string;
    syncCrawlFallback?: boolean;
    allowAsyncCrawl?: boolean;
  } = {}
): Promise<BatchDiscoveryEntry[]> {
  if (!items.length) return [];

  return runPool(
    items,
    discoveryConcurrency(),
    async (item) => {
      const result = await discoverProducts({
        query: item.query,
        userId: shared.userId,
        generationJobId: shared.generationJobId,
        rankingContext: item.rankingContext,
        syncCrawlFallback: shared.syncCrawlFallback,
        // Batch mode never blocks on the slow async crawl queue.
        allowAsyncCrawl: shared.allowAsyncCrawl ?? false,
      });
      return { ...result, key: item.key };
    },
    (item, _i, err) => ({
      key: item.key,
      products: [],
      status: "failed" as SessionStatus,
      providerMeta: {
        degraded: true,
        failures: [
          {
            system: "product_search",
            provider: "batch",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      },
      availableOnly: false,
    })
  );
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

import { afterEach, describe, expect, it, vi } from "vitest";
import { readDiscoveryFlags } from "@/lib/flags";

const requestLog: string[] = [];
const coverageCreate = vi.hoisted(() =>
  vi.fn(
    async (_input: {
      data: { intent: Record<string, string | null>; poolSize: number };
    }) => ({ id: "gap" })
  )
);
const discoveryLogCreate = vi.hoisted(() => vi.fn(async () => ({ id: "log" })));
const enqueueProductCrawl = vi.hoisted(() => vi.fn(async () => "job-1"));

vi.mock("./index/search", () => ({
  searchProductIndex: vi.fn(async () => []),
}));

vi.mock("./session", () => ({
  createProductSearchSession: vi.fn(async () => "sess-1"),
  updateProductSearchSession: vi.fn(async () => undefined),
}));

vi.mock("./crawl-queue", () => ({
  enqueueProductCrawl,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageGap: { create: coverageCreate },
    discoveryLog: { create: discoveryLogCreate },
  },
}));

import { discoverProducts } from "./discovery";
import {
  COVERAGE_GAP_MIN_POOL,
  discoveryV2SkipsExternalSearch,
  shouldRecordCoverageGap,
} from "./discovery-log";
import { crawlLiveProductProvider } from "./providers/crawl-live";
import { googleShoppingProductProvider } from "./providers/google-shopping";
import { serpApiProductProvider } from "./providers/serpapi";

const ENV_KEYS = [
  "DISCOVERY_V2",
  "SERPAPI_KEY",
  "SERPAPI_ENABLED",
  "GOOGLE_SHOPPING_ENABLED",
  "PRODUCT_CRAWLER_URL",
  "PRODUCT_DISCOVERY_LAYERS",
  "LIVE_PLAYWRIGHT_IN_REQUEST",
] as const;

const savedEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

const query = {
  query: "women party dress",
  region: "IN" as const,
  category: "dress",
};

function stubFetch() {
  requestLog.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requestLog.push(url);
      return new Response(JSON.stringify({ shopping_results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
}

function forbiddenHosts(urls: string[]): string[] {
  return urls.filter(
    (url) => url.includes("serpapi.com") || url.includes("google.com/search")
  );
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const previous = savedEnv[key];
    if (previous == null) delete process.env[key];
    else process.env[key] = previous;
  }
  requestLog.length = 0;
  coverageCreate.mockClear();
  discoveryLogCreate.mockClear();
  enqueueProductCrawl.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("discovery v2 helpers", () => {
  it("keeps external search on the default path and records a thin v2 pool", () => {
    expect(discoveryV2SkipsExternalSearch(false)).toBe(false);
    expect(discoveryV2SkipsExternalSearch(true)).toBe(true);
    expect(COVERAGE_GAP_MIN_POOL).toBe(40);
    expect(shouldRecordCoverageGap(false, 0)).toBe(false);
    expect(shouldRecordCoverageGap(true, 39)).toBe(true);
    expect(shouldRecordCoverageGap(true, 40)).toBe(false);
  });
});

describe("discoverProducts DISCOVERY_V2", () => {
  it("still calls serpapi and the crawler google-shopping path by default", async () => {
    expect(readDiscoveryFlags().discoveryV2).toBe(false);
    expect(readDiscoveryFlags().serpapiEnabled).toBe(true);
    expect(readDiscoveryFlags().googleShoppingEnabled).toBe(true);

    process.env.SERPAPI_KEY = "test-key";
    process.env.PRODUCT_CRAWLER_URL = "http://crawler.local";
    stubFetch();
    const serp = vi.spyOn(serpApiProductProvider, "search");
    const google = vi.spyOn(googleShoppingProductProvider, "search");

    await discoverProducts({
      query,
      allowAsyncCrawl: true,
      syncCrawlFallback: true,
    });

    expect(serp).toHaveBeenCalled();
    expect(google).toHaveBeenCalled();
    expect(requestLog.some((url) => url.includes("serpapi.com"))).toBe(true);
    expect(requestLog.some((url) => url.includes("/crawl/google-shopping"))).toBe(
      true
    );
    expect(enqueueProductCrawl).toHaveBeenCalled();
    expect(coverageCreate).not.toHaveBeenCalled();
  });

  it("does not call serpapi or google when DISCOVERY_V2 is on", async () => {
    process.env.DISCOVERY_V2 = "true";
    process.env.SERPAPI_ENABLED = "false";
    process.env.GOOGLE_SHOPPING_ENABLED = "false";
    process.env.SERPAPI_KEY = "test-key";
    process.env.PRODUCT_CRAWLER_URL = "http://crawler.local";
    process.env.PRODUCT_DISCOVERY_LAYERS = "cache,index,shopping,crawl,demo";
    stubFetch();
    const serp = vi.spyOn(serpApiProductProvider, "search");
    const google = vi.spyOn(googleShoppingProductProvider, "search");
    const crawl = vi.spyOn(crawlLiveProductProvider, "search");

    const result = await discoverProducts({
      query,
      allowAsyncCrawl: true,
      syncCrawlFallback: true,
    });

    expect(serp).not.toHaveBeenCalled();
    expect(google).not.toHaveBeenCalled();
    expect(crawl).not.toHaveBeenCalled();
    expect(enqueueProductCrawl).not.toHaveBeenCalled();
    expect(forbiddenHosts(requestLog)).toEqual([]);
    expect(requestLog.some((url) => url.includes("google.com"))).toBe(false);
    const used = result.providerMeta.providersUsed ?? [];
    expect(used).not.toContain("serpapi");
    expect(used).not.toContain("google-shopping");
    expect(used).not.toContain("demo");
    expect(used).not.toContain("crawl-sync");
    expect(used).not.toContain("crawl-queued");
    expect(
      result.products.some((product) => product.url.includes("example.com"))
    ).toBe(false);
    expect(coverageCreate).toHaveBeenCalledTimes(1);
    expect(coverageCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        poolSize: 0,
        intent: {
          query: "women party dress",
          category: "dress",
          region: "IN",
        },
      },
    });
  });

  it("skips serpapi and google even when those flags stay at their defaults", async () => {
    process.env.DISCOVERY_V2 = "true";
    process.env.SERPAPI_KEY = "test-key";
    process.env.PRODUCT_CRAWLER_URL = "http://crawler.local";
    expect(readDiscoveryFlags().serpapiEnabled).toBe(true);
    expect(readDiscoveryFlags().googleShoppingEnabled).toBe(true);
    stubFetch();
    const serp = vi.spyOn(serpApiProductProvider, "search");
    const google = vi.spyOn(googleShoppingProductProvider, "search");

    await discoverProducts({
      query,
      syncCrawlFallback: true,
    });

    expect(serp).not.toHaveBeenCalled();
    expect(google).not.toHaveBeenCalled();
    expect(forbiddenHosts(requestLog)).toEqual([]);
    expect(coverageCreate).toHaveBeenCalledTimes(1);
  });
});

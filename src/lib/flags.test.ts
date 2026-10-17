import { afterEach, describe, expect, it } from "vitest";
import { readDiscoveryFlags } from "./flags";

const names = [
  "GOOGLE_SHOPPING_ENABLED",
  "SERPAPI_ENABLED",
  "LIVE_PLAYWRIGHT_IN_REQUEST",
  "VERIFIER_V2",
  "CLICK_REVALIDATE",
  "HYBRID_SEARCH",
  "DISCOVERY_V2",
  "SLOT_QUERY_MODE",
  "REQUIRE_GENDER",
  "CACHE_BACKEND",
  "DELIVERY_TIERS",
  "GENERATION_SHORTLIST",
  "INGEST_FLIPKART_ENABLED",
  "INGEST_ADMITAD_ENABLED",
  "INGEST_AMAZON_ENABLED",
  "INGEST_SHOPIFY_ENABLED",
  "INGEST_SITEMAP_ENABLED",
] as const;

afterEach(() => {
  for (const name of names) delete process.env[name];
});

describe("readDiscoveryFlags", () => {
  it("keeps today's search path when env vars are unset", () => {
    const flags = readDiscoveryFlags({});
    expect(flags.googleShoppingEnabled).toBe(true);
    expect(flags.serpapiEnabled).toBe(true);
    expect(flags.livePlaywrightInRequest).toBe(true);
    expect(flags.verifierV2).toBe(false);
    expect(flags.clickRevalidate).toBe(false);
    expect(flags.hybridSearch).toBe(false);
    expect(flags.discoveryV2).toBe(false);
    expect(flags.slotQueryMode).toBe("v1");
    expect(flags.requireGender).toBe(false);
    expect(flags.cacheBackend).toBe("memory");
    expect(flags.deliveryTiers).toBe(false);
    expect(flags.generationShortlist).toBe(false);
    expect(flags.ingestFlipkartEnabled).toBe(false);
    expect(flags.ingestShopifyEnabled).toBe(false);
  });

  it("turns a provider off without removing the code path", () => {
    const flags = readDiscoveryFlags({
      SERPAPI_ENABLED: "false",
      GOOGLE_SHOPPING_ENABLED: "false",
      LIVE_PLAYWRIGHT_IN_REQUEST: "false",
      SLOT_QUERY_MODE: "v2",
      CACHE_BACKEND: "postgres",
    });
    expect(flags.serpapiEnabled).toBe(false);
    expect(flags.googleShoppingEnabled).toBe(false);
    expect(flags.livePlaywrightInRequest).toBe(false);
    expect(flags.slotQueryMode).toBe("v2");
    expect(flags.cacheBackend).toBe("postgres");
  });
});

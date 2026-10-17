/**
 * Runtime discovery flags. Defaults keep today's search path.
 * Set an env var to "true" or "false". Missing vars use the start default.
 */

export type CacheBackend = "memory" | "postgres";
export type SlotQueryMode = "v1" | "v2";

export type DiscoveryFlags = {
  googleShoppingEnabled: boolean;
  serpapiEnabled: boolean;
  livePlaywrightInRequest: boolean;
  verifierV2: boolean;
  clickRevalidate: boolean;
  hybridSearch: boolean;
  discoveryV2: boolean;
  slotQueryMode: SlotQueryMode;
  requireGender: boolean;
  cacheBackend: CacheBackend;
  deliveryTiers: boolean;
  generationShortlist: boolean;
  ingestFlipkartEnabled: boolean;
  ingestAdmitadEnabled: boolean;
  ingestAmazonEnabled: boolean;
  ingestShopifyEnabled: boolean;
  ingestSitemapEnabled: boolean;
};

/** A subset of process.env. NODE_ENV is not required, so tests can pass `{}`. */
export type FlagEnv = Record<string, string | undefined>;

function readBool(env: FlagEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return fallback;
  return raw.trim().toLowerCase() === "true";
}

export function readDiscoveryFlags(env: FlagEnv = process.env): DiscoveryFlags {
  const slot = (env.SLOT_QUERY_MODE ?? "v1").trim().toLowerCase();
  const cache = (env.CACHE_BACKEND ?? "memory").trim().toLowerCase();
  return {
    googleShoppingEnabled: readBool(env, "GOOGLE_SHOPPING_ENABLED", true),
    serpapiEnabled: readBool(env, "SERPAPI_ENABLED", true),
    livePlaywrightInRequest: readBool(env, "LIVE_PLAYWRIGHT_IN_REQUEST", true),
    verifierV2: readBool(env, "VERIFIER_V2", false),
    clickRevalidate: readBool(env, "CLICK_REVALIDATE", false),
    hybridSearch: readBool(env, "HYBRID_SEARCH", false),
    discoveryV2: readBool(env, "DISCOVERY_V2", false),
    slotQueryMode: slot === "v2" ? "v2" : "v1",
    requireGender: readBool(env, "REQUIRE_GENDER", false),
    cacheBackend: cache === "postgres" ? "postgres" : "memory",
    deliveryTiers: readBool(env, "DELIVERY_TIERS", false),
    generationShortlist: readBool(env, "GENERATION_SHORTLIST", false),
    ingestFlipkartEnabled: readBool(env, "INGEST_FLIPKART_ENABLED", false),
    ingestAdmitadEnabled: readBool(env, "INGEST_ADMITAD_ENABLED", false),
    ingestAmazonEnabled: readBool(env, "INGEST_AMAZON_ENABLED", false),
    ingestShopifyEnabled: readBool(env, "INGEST_SHOPIFY_ENABLED", false),
    ingestSitemapEnabled: readBool(env, "INGEST_SITEMAP_ENABLED", false),
  };
}

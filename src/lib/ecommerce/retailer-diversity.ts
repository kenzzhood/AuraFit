import { retailerDomain } from "./fingerprint";
import type { Product } from "./product";

/** Marketplaces that must appear in India-facing results when they have hits. */
export const CORE_MARKETPLACE_DOMAINS = [
  "amazon.in",
  "amazon.com",
  "amazon.co.uk",
  "myntra.com",
  "ajio.com",
  "flipkart.com",
  "nykaafashion.com",
  "nykaa.com",
  "tatacliq.com",
  "meesho.com",
];

/** Department / brand sites we want in the mix after the big-3. */
export const PREFERRED_BRAND_DOMAINS = [
  "zara.com",
  "hm.com",
  "uniqlo.com",
  "asos.com",
  "westside.com",
  "lifestylestores.com",
  "maxfashion.in",
  "marksandspencer.in",
  "shoppersstop.com",
  "bewakoof.com",
  "thesouledstore.com",
  "urbanic.com",
];

const BOUTIQUE_DOMAINS = [
  "bananaclub.co.in",
  "snitch.co.in",
  "snitch.com",
  "thebanyantree.in",
];

function hostMatches(host: string, domains: readonly string[]): boolean {
  if (!host) return false;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isCoreMarketplace(url: string | undefined | null): boolean {
  return hostMatches(retailerDomain(url), CORE_MARKETPLACE_DOMAINS);
}

export function isPreferredBrand(url: string | undefined | null): boolean {
  return hostMatches(retailerDomain(url), PREFERRED_BRAND_DOMAINS);
}

export function isBoutiqueRetailer(url: string | undefined | null): boolean {
  return hostMatches(retailerDomain(url), BOUTIQUE_DOMAINS);
}

export function coreMarketplaceCount(products: Product[]): number {
  const hosts = new Set<string>();
  for (const p of products) {
    const host = retailerDomain(p.canonicalUrl ?? p.url);
    if (hostMatches(host, CORE_MARKETPLACE_DOMAINS)) hosts.add(host);
  }
  return hosts.size;
}

/**
 * Keep searching live sources until the pool looks like a real Google
 * shopping page: several stores, including at least two marketplaces.
 * Boutiques are welcome — they just cannot be the entire pool.
 */
export function hasMarketplaceCoverage(products: Product[]): boolean {
  const hosts = new Set(
    products
      .map((p) => retailerDomain(p.canonicalUrl ?? p.url))
      .filter(Boolean)
  );
  if (hosts.size < 4) return false;
  return coreMarketplaceCount(products) >= 2;
}

/**
 * Keep rank order inside each store, then rotate stores so Amazon, Myntra,
 * Ajio, Snitch, Banana Club and the rest all appear — none can fill the list.
 */
export function diversifyByRetailer<T>(
  items: T[],
  urlOf: (item: T) => string | undefined,
  opts?: { maxPerRetailer?: number }
): T[] {
  if (items.length <= 1) return items;
  const maxPer = opts?.maxPerRetailer ?? 3;

  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const host = retailerDomain(urlOf(item)) || "_unknown";
    if (!buckets.has(host)) {
      buckets.set(host, []);
      order.push(host);
    }
    const bucket = buckets.get(host)!;
    if (bucket.length < maxPer) bucket.push(item);
  }

  const out: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const host of order) {
      const bucket = buckets.get(host);
      if (bucket?.length) {
        out.push(bucket.shift() as T);
        added = true;
      }
    }
  }
  return out;
}

export function diversifyProducts(
  products: Product[],
  maxPerRetailer = 3
): Product[] {
  return diversifyByRetailer(
    products,
    (p) => p.canonicalUrl ?? p.url,
    { maxPerRetailer }
  );
}

/** Spread stores evenly. Kept as a named export for discovery/index callers. */
export function preferMarketplaceProducts(products: Product[]): Product[] {
  return diversifyProducts(products, 3);
}

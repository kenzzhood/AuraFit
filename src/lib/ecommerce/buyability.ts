import type { Product } from "./product";
import { retailerDomain } from "./fingerprint";

const STALE_PDP_MS = 7 * 24 * 3600 * 1000;

export function expectedCurrency(region: "IN" | "US" | "UK"): string {
  if (region === "US") return "USD";
  if (region === "UK") return "GBP";
  return "INR";
}

export function currencyMatchesRegion(
  currency: string | undefined,
  region: "IN" | "US" | "UK"
): boolean {
  if (!currency) return true;
  const c = currency.trim().toUpperCase();
  if (region === "IN") {
    return c === "INR" || c === "RS" || c === "₹" || c.includes("INR");
  }
  if (region === "US") {
    return c === "USD" || c === "$" || c.includes("USD");
  }
  return c === "GBP" || c === "£" || c.includes("GBP");
}

export function filterProductsToRegion(
  products: Product[],
  region: "IN" | "US" | "UK"
): Product[] {
  const fitted = products.filter((p) =>
    currencyMatchesRegion(p.currency, region)
  );
  return fitted.length ? fitted : products;
}

/**
 * 1 = clearly local, 0 = wrong-country storefront. Used as a ranking signal
 * rather than a hard drop so global .com listings can still win when they
 * ship to the user.
 */
export function regionTldScore(
  url: string | undefined,
  region: "IN" | "US" | "UK"
): number {
  const host = retailerDomain(url);
  if (!host) return 0.5;

  const indiaStore =
    /\.(co\.)?in$/.test(host) ||
    /(myntra|flipkart|ajio|nykaa|meesho|tatacliq|limeroad)/.test(
      host
    );
  const ukStore = /\.co\.uk$/.test(host) || host.includes("amazon.co.uk");
  const usAmazon = host === "amazon.com" || host.endsWith(".amazon.com");

  if (region === "IN") {
    if (ukStore || usAmazon) return 0;
    if (indiaStore || host.includes("amazon.in")) return 1;
    return 0.55;
  }
  if (region === "UK") {
    if (indiaStore) return 0;
    if (ukStore) return 1;
    return 0.55;
  }
  if (indiaStore || ukStore) return 0;
  if (usAmazon) return 1;
  return 0.6;
}

/**
 * Decide whether a candidate needs a live PDP check before we promise the
 * user they can buy it.
 *
 * - Never-verified rows: yes — a PDP crawl is their only path to "verified".
 * - Crawler-validated rows: only when stale (>7 days) — links rot.
 * - Live shopping listings (verified, no crawl timestamp): NO. They come
 *   straight from a merchant feed fetched seconds ago; forcing a Playwright
 *   round-trip on bot-hardened retail pages mostly produces false negatives
 *   and empties the board.
 */
export function needsPdpVerification(product: Product): boolean {
  const crawledAgo = product.lastCrawledAt
    ? Date.now() - Date.parse(product.lastCrawledAt)
    : null;
  const stale =
    crawledAgo != null && Number.isFinite(crawledAgo) && crawledAgo > STALE_PDP_MS;

  if (product.pdpVerified === true) return stale;
  if (product.verified === true) return stale;
  return true;
}

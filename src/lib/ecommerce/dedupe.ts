import type { Product } from "./product";
import { titleFingerprint, normalizeProductUrl } from "./fingerprint";

function fuzzyKey(p: Product): string {
  const fp = titleFingerprint(p.title);
  if (fp) return fp;
  const brand = (p.brand ?? p.storeName ?? "").toLowerCase().slice(0, 32);
  const title = p.title.toLowerCase().slice(0, 48);
  return `${brand}::${title}`;
}

/**
 * Dedupe by URL, then token-sorted title fingerprint (same garment, shuffled words).
 */
export function dedupeProducts(products: Product[]): Product[] {
  const byUrl = new Map<string, Product>();
  const byFuzzy = new Map<string, Product>();

  for (const p of products) {
    const urlKey = normalizeProductUrl(p.canonicalUrl ?? p.url);
    if (!byUrl.has(urlKey)) {
      byUrl.set(urlKey, p);
      continue;
    }
    const existing = byUrl.get(urlKey)!;
    // Prefer verified products, then higher-rating ones — a snippet record
    // and a validated record for the same URL should always collapse to the
    // validated one so verified=true survives the dedupe.
    if (p.verified === true && existing.verified !== true) {
      byUrl.set(urlKey, p);
      continue;
    }
    if (p.pdpVerified === true && existing.pdpVerified !== true) {
      byUrl.set(urlKey, p);
      continue;
    }
    if (p.verified === existing.verified && (p.rating ?? 0) > (existing.rating ?? 0)) {
      byUrl.set(urlKey, p);
    }
  }

  for (const p of byUrl.values()) {
    const fk = fuzzyKey(p);
    if (!byFuzzy.has(fk)) {
      byFuzzy.set(fk, p);
      continue;
    }
    const existing = byFuzzy.get(fk)!;
    if (p.pdpVerified === true && existing.pdpVerified !== true) {
      byFuzzy.set(fk, p);
      continue;
    }
    if ((p.price ?? 0) > 0 && (existing.price ?? 0) === 0) {
      byFuzzy.set(fk, p);
    }
  }

  return [...byFuzzy.values()];
}

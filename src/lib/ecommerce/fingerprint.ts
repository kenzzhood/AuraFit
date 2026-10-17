/**
 * Stable identity helpers for product uniqueness across a generation board.
 *
 * URL keys catch the same listing. Title fingerprints catch the same garment
 * sold under slightly different titles ("Floral Midi Dress - Blue" vs
 * "Blue Floral Midi Dress") without collapsing every polo on the board into
 * one slot — colors stay in the fingerprint; size/gender/stopwords do not.
 */

const FINGERPRINT_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "with",
  "for",
  "in",
  "on",
  "of",
  "to",
  "by",
  "from",
  "men",
  "mens",
  "man",
  "women",
  "womens",
  "woman",
  "male",
  "female",
  "unisex",
  "ladies",
  "boys",
  "girls",
  "boy",
  "girl",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "small",
  "medium",
  "large",
  "size",
  "pack",
  "pcs",
  "piece",
]);

/** snitch.co.in moved to snitch.com — keep path and query. */
export function rewriteLegacyRetailerUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!/snitch\.co\.in/i.test(u.hostname)) return url;
    u.hostname = u.hostname.replace(/snitch\.co\.in/gi, "snitch.com");
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * True ONLY for live snitch.com PDPs: `/<category>/<handle>/<numericId>/buy`
 * (4+ path segments, last segment "buy", second-to-last all digits).
 *
 * The new snitch.com is a custom Next.js site — Shopify-era
 * `/products/<handle>` paths render an empty "Oops! Can't Find That" shell,
 * and old snitch.co.in handles cannot be mapped, so both are always false.
 */
export function isUsableSnitchProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("snitch.co.in")) return false;
    if (!host.includes("snitch.com")) return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return (
      parts.length >= 4 &&
      parts[parts.length - 1]!.toLowerCase() === "buy" &&
      /^\d+$/.test(parts[parts.length - 2]!)
    );
  } catch {
    return false;
  }
}

/**
 * Null for any snitch.co.in URL (old Shopify handles do not exist on the new
 * site) and for snitch.com URLs that are not live PDPs. The host rewrite no
 * longer rescues Snitch product URLs — it only dedupes/normalizes elsewhere.
 */
export function usableMerchantUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("snitch.co.in")) return null;
    if (host.includes("snitch.com") && !isUsableSnitchProductUrl(url)) {
      return null;
    }
    return rewriteLegacyRetailerUrl(url);
  } catch {
    return null;
  }
}

export function isUsableShopUrl(url: string): boolean {
  return usableMerchantUrl(url) != null;
}

export function pickUsableShopUrl(
  ...urls: Array<string | undefined | null>
): string | null {
  for (const url of urls) {
    if (!url) continue;
    const usable = usableMerchantUrl(url);
    if (usable) return usable;
  }
  return null;
}

/** Same gate as isUsableShopUrl — dead Snitch listings must never enter the index. */
export function isIndexableProductUrl(url: string): boolean {
  return isUsableShopUrl(url);
}

export function normalizeProductUrl(url: string): string {
  try {
    const u = new URL(rewriteLegacyRetailerUrl(url));
    u.hash = "";
    u.search = "";
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function retailerDomain(url: string | undefined | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function titleFingerprint(title: string): string {
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (t) => t.length > 1 && !FINGERPRINT_STOP.has(t) && !/^\d+$/.test(t)
    );
  return [...new Set(tokens)].sort().slice(0, 6).join(" ");
}

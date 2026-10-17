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

/** A lone `%` is a cut-off link. `new URL` still accepts it. */
function hasTruncatedPercentEncoding(value: string): boolean {
  return /%(?![0-9A-Fa-f]{2})/.test(value);
}

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "google.co.in" ||
    host.endsWith(".google.co.in")
  );
}

/**
 * Unwrap a Google `/url?q=` or `/url?url=` wrapper, including one extra
 * percent-encoding of the inner URL. Relative paths that are not wrappers,
 * leftover Google hosts, and strings that are not http(s) URLs are rejected.
 * A normal merchant URL is returned unchanged.
 */
export function unwrapMerchantUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let current = raw.trim();
  if (
    !current ||
    current.toLowerCase().startsWith("javascript:") ||
    current.toLowerCase().startsWith("data:")
  ) {
    return null;
  }

  for (let hop = 0; hop < 2; hop++) {
    if (hasTruncatedPercentEncoding(current)) return null;
    if (current.startsWith("/") && !current.startsWith("/url?")) return null;
    let parsed: URL;
    try {
      parsed = current.startsWith("/url?")
        ? new URL(current, "https://www.google.com")
        : new URL(current);
    } catch {
      try {
        const decoded = decodeURIComponent(current);
        if (
          decoded === current ||
          !(
            decoded.startsWith("http://") ||
            decoded.startsWith("https://") ||
            decoded.startsWith("/url?")
          )
        ) {
          return null;
        }
        current = decoded;
        continue;
      } catch {
        return null;
      }
    }
    const host = parsed.hostname.toLowerCase();
    if (isGoogleHost(host) && parsed.pathname.startsWith("/url")) {
      const inner = (parsed.searchParams.get("q") || parsed.searchParams.get("url") || "").trim();
      if (!inner) return null;
      current = inner;
      continue;
    }
    if (isGoogleHost(host)) return null;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return current;
  }

  if (hasTruncatedPercentEncoding(current)) return null;
  try {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isGoogleHost(parsed.hostname)) return null;
    return current;
  } catch {
    return null;
  }
}

/**
 * Null for any snitch.co.in URL (old Shopify handles do not exist on the new
 * site) and for snitch.com URLs that are not live PDPs. Google wrappers are
 * unwrapped first; a URL that is still on Google is rejected. The host rewrite
 * no longer rescues Snitch product URLs — it only dedupes/normalizes elsewhere.
 */
export function usableMerchantUrl(url: string): string | null {
  const unwrapped = unwrapMerchantUrl(url);
  if (!unwrapped) return null;
  try {
    const host = new URL(unwrapped).hostname.toLowerCase();
    if (isGoogleHost(host)) return null;
    if (host.includes("snitch.co.in")) return null;
    if (host.includes("snitch.com") && !isUsableSnitchProductUrl(unwrapped)) {
      return null;
    }
    return rewriteLegacyRetailerUrl(unwrapped);
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

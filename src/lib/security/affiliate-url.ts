/**
 * Outbound affiliate / retailer URL policy.
 * HTTPS only; no javascript:/data:; no IP literals; retailer allowlist (+ optional extras).
 */

const BLOCKED_HOST_EXACT = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
]);

/** Known fashion / marketplace hosts (registrable or brand CDN). */
const RETAILER_SUFFIXES = [
  "amazon.in",
  "amazon.com",
  "amazon.co.uk",
  "amzn.to",
  "amzn.in",
  "myntra.com",
  "ajio.com",
  "flipkart.com",
  "nykaa.com",
  "nykaafashion.com",
  "tatacliq.com",
  "snapdeal.com",
  "meesho.com",
  "shopify.com",
  "myshopify.com",
  "zara.com",
  "hm.com",
  "asos.com",
  "nordstrom.com",
  "macys.com",
  "gap.com",
  "oldnavy.com",
  "uniqlo.com",
  "nike.com",
  "adidas.com",
  "puma.com",
  "levi.com",
  "levi.in",
  "ralphlauren.com",
  "ssense.com",
  "farfetch.com",
  "net-a-porter.com",
  "mrporter.com",
  "matchesfashion.com",
  "bloomingdales.com",
  "saksfifthavenue.com",
  "urbanoutfitters.com",
  "anthropologie.com",
  "freepeople.com",
  "lululemon.com",
  "patagonia.com",
  "rei.com",
  "target.com",
  "walmart.com",
  "ebay.com",
  "ebay.in",
  "shein.com",
  "aliexpress.com",
  "etsy.com",
  "jabong.com",
  "koovs.com",
  "lifestyle.com",
  "shoppersstop.com",
  "reliancetrends.com",
  "pantaloons.com",
  "maxfashion.in",
  "westside.com",
  "decathlon.in",
  "decathlon.com",
  "bewakoof.com",
  "snitch.com",
  "snitch.co.in",
  "thesouledstore.com",
  "nobero.com",
  "xyxxcrew.com",
  "bonkerscorner.com",
  "freakins.com",
  "newme.asia",
  "libas.in",
  "biba.in",
  "andindia.com",
  "fablestreet.com",
  "houseofindya.com",
  "savana.com",
  "culturesociety.com",
  "rareism.com",
];

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isIpLiteralHost(host: string): boolean {
  if (parseIpv4(host)) return true;
  if (host.startsWith("[") && host.endsWith("]")) return true;
  // bare IPv6 without brackets rarely appears as hostname, but reject hex:colon forms
  if (host.includes(":") && !host.includes(".")) return true;
  return false;
}

function hostAllowedBySuffix(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

function extraAllowedHosts(): string[] {
  const raw = process.env.AFFILIATE_ALLOWED_HOSTS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAffiliateUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.includes(" ")) return false;
  if (BLOCKED_HOST_EXACT.has(host)) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIpLiteralHost(host)) return false;
  if (host === "169.254.169.254" || host.startsWith("169.254.")) return false;

  const allow = [...RETAILER_SUFFIXES, ...extraAllowedHosts()];
  return allow.some((suffix) => hostAllowedBySuffix(host, suffix));
}

export function assertAllowedAffiliateUrl(raw: string): URL {
  if (!isAllowedAffiliateUrl(raw)) {
    throw new Error("URL is not an allowed retailer destination");
  }
  return new URL(raw);
}

export function filterAllowedUrls(urls: string[]): string[] {
  return urls.filter(isAllowedAffiliateUrl);
}

/** Zod refine helper — rejects javascript:/data:/http: and non-retailers. */
export function httpsRetailerUrl(): (value: string) => boolean {
  return (value) => isAllowedAffiliateUrl(value);
}

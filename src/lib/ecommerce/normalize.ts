import { createHash } from "crypto";
import type { Product, ProductAvailability } from "./product";

export type RawProductInput = Record<string, unknown>;

function parseAvailability(v: unknown): ProductAvailability {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("in") && s.includes("stock")) return "in_stock";
  if (s.includes("out")) return "out_of_stock";
  return "unknown";
}

function parsePrice(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.]/g, ""));
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function parseStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x)).filter(Boolean);
}

/**
 * Single mapper for SerpAPI, crawler JSON, Scrapy payloads, demo data.
 */
export function normalizeProduct(
  raw: RawProductInput,
  source: string,
  defaults?: { region?: string; currency?: string }
): Product {
  const title = String(
    raw.title ?? raw.name ?? raw.product_title ?? "Product"
  );
  const url = String(
    raw.url ?? raw.productUrl ?? raw.link ?? raw.product_link ?? ""
  );
  const externalId = String(
    raw.externalId ??
      raw.product_id ??
      raw.id ??
      createHash("sha256").update(`${source}:${url}:${title}`).digest("hex").slice(0, 24)
  );

  const product: Product = {
    externalId,
    title,
    brand: raw.brand ? String(raw.brand) : raw.storeName ? String(raw.storeName) : undefined,
    price: parsePrice(raw.price ?? raw.extracted_price),
    currency: String(raw.currency ?? defaults?.currency ?? "INR"),
    image: raw.image
      ? String(raw.image)
      : raw.imageUrl
        ? String(raw.imageUrl)
        : raw.thumbnail
          ? String(raw.thumbnail)
          : undefined,
    url,
    source,
    colors: parseStringArray(raw.colors),
    category: raw.category ? String(raw.category) : undefined,
    aestheticTags: parseStringArray(raw.aestheticTags ?? raw.tags),
    rating:
      typeof raw.rating === "number"
        ? raw.rating
        : raw.rating
          ? parseFloat(String(raw.rating))
          : undefined,
    availability: parseAvailability(raw.availability),
    region: raw.region ? String(raw.region) : defaults?.region,
    storeName: raw.storeName ? String(raw.storeName) : raw.source ? String(raw.source) : undefined,
    // Verification metadata from the crawler's product-detail resolver. We
    // require `verified === true` to ever show a product as a real link.
    verified: raw.verified === true,
    canonicalUrl: raw.canonicalUrl ? String(raw.canonicalUrl) : undefined,
    matchCategory: raw.matchCategory ? String(raw.matchCategory) : undefined,
    matchConfidence:
      typeof raw.matchConfidence === "number"
        ? raw.matchConfidence
        : raw.matchConfidence
          ? parseFloat(String(raw.matchConfidence))
          : undefined,
  };

  return product;
}

export function productContentHash(p: Product): string {
  const payload = [
    p.title,
    p.brand ?? "",
    String(p.price ?? ""),
    p.url,
    p.category ?? "",
    (p.colors ?? []).join(","),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function normalizeProductBatch(
  items: RawProductInput[],
  source: string,
  defaults?: { region?: string; currency?: string }
): Product[] {
  return items.map((raw) => normalizeProduct(raw, source, defaults));
}

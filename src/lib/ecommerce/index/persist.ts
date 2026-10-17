import { ProductAvailability as PrismaAvailability } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productContentHash, normalizeProduct } from "@/lib/ecommerce/normalize";
import type { Product } from "@/lib/ecommerce/product";
import { isIndexableProductUrl } from "@/lib/ecommerce/fingerprint";
import { upsertProductEmbedding } from "./embeddings";

function toPrismaAvailability(
  a?: string
): PrismaAvailability {
  if (a === "in_stock") return PrismaAvailability.IN_STOCK;
  if (a === "out_of_stock") return PrismaAvailability.OUT_OF_STOCK;
  return PrismaAvailability.UNKNOWN;
}

export async function upsertProductIndex(
  product: Product,
  options?: { embed?: boolean }
): Promise<string | null> {
  if (!isIndexableProductUrl(product.url)) {
    return null;
  }
  const hash = productContentHash(product);
  const row = await prisma.productIndex.upsert({
    where: { productUrl: product.url },
    create: {
      externalId: product.externalId,
      source: product.source,
      title: product.title,
      brand: product.brand,
      price: product.price != null ? Math.round(product.price) : undefined,
      currency: product.currency,
      imageUrl: product.image,
      productUrl: product.url,
      category: product.category,
      colors: product.colors ?? undefined,
      aestheticTags: product.aestheticTags ?? undefined,
      rating: product.rating,
      availability: toPrismaAvailability(product.availability),
      region: product.region ?? "IN",
      contentHash: hash,
      raw: product as object,
      lastCrawledAt: new Date(),
    },
    update: {
      title: product.title,
      brand: product.brand,
      price: product.price != null ? Math.round(product.price) : undefined,
      currency: product.currency,
      imageUrl: product.image,
      category: product.category,
      colors: product.colors ?? undefined,
      aestheticTags: product.aestheticTags ?? undefined,
      rating: product.rating,
      availability: toPrismaAvailability(product.availability),
      contentHash: hash,
      raw: product as object,
      lastCrawledAt: new Date(),
    },
  });

  if (options?.embed !== false) {
    const text = [product.title, product.brand, product.category, ...(product.aestheticTags ?? [])]
      .filter(Boolean)
      .join(" ");
    await upsertProductEmbedding(row.id, text, hash);
  }

  return row.id;
}

export async function upsertProductIndexBatch(
  products: Product[],
  options?: { embed?: boolean }
): Promise<string[]> {
  const ids: string[] = [];
  for (const p of products) {
    const id = await upsertProductIndex(p, options);
    if (id) ids.push(id);
  }
  return ids;
}

export function indexRowToProduct(row: {
  id: string;
  externalId: string;
  source: string;
  title: string;
  brand: string | null;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
  category: string | null;
  colors: unknown;
  aestheticTags: unknown;
  rating: number | null;
  availability: PrismaAvailability;
  region: string;
  lastCrawledAt?: Date | null;
  raw?: unknown;
}): Product {
  const availabilityMap: Record<PrismaAvailability, Product["availability"]> = {
    IN_STOCK: "in_stock",
    OUT_OF_STOCK: "out_of_stock",
    UNKNOWN: "unknown",
  };

  // The `raw` JSON column carries the full Product captured at crawl time,
  // including verified / canonicalUrl / matchCategory which don't have their
  // own indexed columns. Reuse them so downstream layers know the product
  // was validated against a real detail page.
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as
    Record<string, unknown>;

  return normalizeProduct(
    {
      id: row.id,
      externalId: row.externalId,
      source: row.source,
      title: row.title,
      brand: row.brand,
      price: row.price ?? undefined,
      currency: row.currency,
      image: row.imageUrl,
      url: row.productUrl,
      category: row.category,
      colors: row.colors,
      aestheticTags: row.aestheticTags,
      rating: row.rating,
      availability: availabilityMap[row.availability],
      region: row.region,
      verified: raw.verified === true,
      canonicalUrl:
        typeof raw.canonicalUrl === "string" ? raw.canonicalUrl : undefined,
      matchCategory:
        typeof raw.matchCategory === "string" ? raw.matchCategory : undefined,
      matchConfidence:
        typeof raw.matchConfidence === "number" ? raw.matchConfidence : undefined,
      lastCrawledAt: row.lastCrawledAt
        ? row.lastCrawledAt.toISOString()
        : undefined,
      pdpVerified: raw.verified === true || raw.pdpVerified === true,
    },
    row.source
  );
}

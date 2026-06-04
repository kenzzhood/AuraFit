import { z } from "zod";

export const productAvailabilitySchema = z.enum([
  "in_stock",
  "out_of_stock",
  "unknown",
]);

export const productSchema = z.object({
  id: z.string().optional(),
  externalId: z.string(),
  title: z.string(),
  brand: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().default("INR"),
  image: z.string().optional(),
  url: z.string().url(),
  source: z.string(),
  colors: z.array(z.string()).optional(),
  category: z.string().optional(),
  aestheticTags: z.array(z.string()).optional(),
  embeddings: z.array(z.number()).optional(),
  rating: z.number().optional(),
  availability: productAvailabilitySchema.optional(),
  region: z.string().optional(),
  storeName: z.string().optional(),
  // Verification metadata — present when the crawler opened the product's
  // detail page and confirmed it is a real, shoppable item (not a search
  // result snippet). Untrusted snippets MUST set `verified: false`.
  verified: z.boolean().optional(),
  /** Canonical detail-page URL from <link rel="canonical"> or stable URL */
  canonicalUrl: z.string().optional(),
  /** Which outfit-item category this product was resolved for ("top", etc.) */
  matchCategory: z.string().optional(),
  /** 0–1 confidence the product matches the requested item */
  matchConfidence: z.number().optional(),
});

export type Product = z.infer<typeof productSchema>;
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

/** Legacy shape used by generation job ProductCache upsert */
export type NormalizedProduct = {
  externalId: string;
  source: string;
  title: string;
  price?: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  category?: string;
  storeName?: string;
  verified?: boolean;
  canonicalUrl?: string;
  availability?: ProductAvailability;
  matchCategory?: string;
  matchConfidence?: number;
  rating?: number;
};

export function productToNormalized(p: Product): NormalizedProduct {
  return {
    externalId: p.externalId,
    source: p.source,
    title: p.title,
    price: p.price,
    currency: p.currency,
    imageUrl: p.image,
    productUrl: p.url,
    category: p.category,
    storeName: p.storeName ?? p.brand,
    verified: p.verified,
    canonicalUrl: p.canonicalUrl,
    availability: p.availability,
    matchCategory: p.matchCategory,
    matchConfidence: p.matchConfidence,
    rating: p.rating,
  };
}

export function normalizedToProduct(p: NormalizedProduct): Product {
  return {
    externalId: p.externalId,
    source: p.source,
    title: p.title,
    price: p.price,
    currency: p.currency,
    image: p.imageUrl,
    url: p.productUrl,
    category: p.category,
    storeName: p.storeName,
    availability: p.availability ?? "unknown",
    verified: p.verified,
    canonicalUrl: p.canonicalUrl,
    matchCategory: p.matchCategory,
    matchConfidence: p.matchConfidence,
    rating: p.rating,
  };
}

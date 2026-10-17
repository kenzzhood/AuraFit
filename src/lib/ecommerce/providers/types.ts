export type ProductSource =
  | "amazon"
  | "flipkart"
  | "myntra"
  | "cached"
  | "serpapi"
  | "demo"
  | "scraper";

/** @deprecated Use NormalizedProduct from ../product */
export interface NormalizedProduct {
  externalId: string;
  source: ProductSource | string;
  title: string;
  price?: number;
  currency: string;
  imageUrl?: string;
  productUrl: string;
  category?: string;
  storeName?: string;
  verified?: boolean;
  canonicalUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  matchCategory?: string;
  matchConfidence?: number;
  rating?: number;
  lastCrawledAt?: string;
  pdpVerified?: boolean;
  region?: string;
}

import type { RetailerSiteOverride } from "@/lib/ecommerce/sites/dynamic-retailers";

export interface ProductQuery {
  query: string;
  category: string;
  region: "IN" | "US" | "UK";
  budgetMin?: number;
  budgetMax?: number;
  /** Keywords from look plan for ranking */
  aestheticKeywords?: string[];
  /** GPT-selected retailer sites for this generation (merged with static fallback server-side). */
  retailerSites?: RetailerSiteOverride[];
}

export interface ProductSearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: ProductQuery): Promise<NormalizedProduct[]>;
}

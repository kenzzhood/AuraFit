import type {
  NormalizedProduct,
  ProductQuery,
  ProductSearchProvider,
  ProductSource,
} from "./types";
import { usableMerchantUrl } from "@/lib/ecommerce/fingerprint";

export type SerpapiShoppingResult = {
  title?: string;
  link?: string;
  product_link?: string;
  extracted_price?: number;
  source?: string;
  thumbnail?: string;
  product_id?: string;
  rating?: number;
};

export function mapSerpapiShoppingResult(
  r: SerpapiShoppingResult,
  q: Pick<ProductQuery, "region" | "category">,
  index: number
): NormalizedProduct | null {
  const productUrl =
    (r.link ? usableMerchantUrl(r.link) : null) ??
    (r.product_link ? usableMerchantUrl(r.product_link) : null);
  if (!r.title || !productUrl) return null;
  const img = r.thumbnail;
  if (!img || !/^https?:\/\//.test(img) || !/^https?:\/\//.test(productUrl)) {
    return null;
  }

  const storeName = r.source ?? "Store";
  const source = inferSourceFromStore(storeName);
  const id =
    r.product_id ??
    `${encodeURIComponent(r.title.slice(0, 40))}-${index}`.slice(0, 80);
  const canonicalUrl =
    (r.product_link ? usableMerchantUrl(r.product_link) : null) ?? productUrl;
  return {
    externalId: id,
    source,
    title: r.title,
    price: r.extracted_price,
    currency: q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
    imageUrl: img,
    productUrl,
    canonicalUrl,
    category: q.category,
    storeName,
    verified: true,
    pdpVerified: false,
    availability: "in_stock",
    matchCategory: q.category,
    rating: r.rating,
    region: q.region,
  };
}

/**
 * Google Shopping via SerpAPI — fallback when Serper.dev is unavailable.
 *
 * Returns the same `verified: true` shape as the Serper provider so the rest
 * of the pipeline (image-edit ingredient list, UI "Shop this look") doesn't
 * care which backend produced the row.
 */

function inferSourceFromStore(store?: string): ProductSource {
  const s = (store ?? "").toLowerCase();
  if (s.includes("amazon")) return "amazon";
  if (s.includes("flipkart")) return "flipkart";
  if (s.includes("myntra")) return "myntra";
  return "serpapi";
}

function regionToGl(region: ProductQuery["region"]): string {
  if (region === "US") return "us";
  if (region === "UK") return "uk";
  return "in";
}

/**
 * How many candidate listings to keep per query. The ranking engine picks the
 * best one per slot, so we want a few real options (not just 1) to choose from.
 */
function maxCandidates(): number {
    const n = Number(process.env.SERPAPI_MAX_CANDIDATES ?? 16);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 16;
}

export const serpApiProductProvider: ProductSearchProvider = {
  name: "serpapi",
  isConfigured: () => !!process.env.SERPAPI_KEY,
  async search(q: ProductQuery): Promise<NormalizedProduct[]> {
    const key = process.env.SERPAPI_KEY;
    if (!key) return [];

    const params = new URLSearchParams({
      engine: "google_shopping",
      q: q.query,
      gl: regionToGl(q.region),
      hl: "en",
      num: "20",
      api_key: key,
    });

    if (q.budgetMin != null) {
      params.set("min_price", String(Math.floor(q.budgetMin)));
    }
    if (q.budgetMax != null) {
      params.set("max_price", String(Math.ceil(q.budgetMax)));
    }

    let res: Response;
    try {
      res = await fetch(`https://serpapi.com/search.json?${params}`, {
        signal: AbortSignal.timeout(12_000),
      });
    } catch (e) {
      console.warn("SerpAPI fetch failed:", e);
      return [];
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("SerpAPI non-2xx:", res.status, text.slice(0, 200));
      return [];
    }

    const data = (await res.json()) as {
      shopping_results?: Array<{
        title?: string;
        link?: string;
        product_link?: string;
        extracted_price?: number;
        source?: string;
        thumbnail?: string;
        product_id?: string;
        rating?: number;
        reviews?: number;
      }>;
    };

    const results = data.shopping_results ?? [];
    return results
      .map((r, i) => mapSerpapiShoppingResult(r, q, i))
      .filter((p): p is NormalizedProduct => p != null)
      .slice(0, maxCandidates());
  },
};

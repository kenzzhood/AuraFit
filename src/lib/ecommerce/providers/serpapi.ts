import type {
  NormalizedProduct,
  ProductQuery,
  ProductSearchProvider,
  ProductSource,
} from "./types";

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
  const n = Number(process.env.SERPAPI_MAX_CANDIDATES ?? 8);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 8;
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
      num: "10",
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
      .filter((r) => {
        // Require the fields we actually need downstream: a real merchant link
        // and a usable http(s) thumbnail (used as an image-gen reference). Skip
        // data: URIs and anything without an image so we never reference a
        // product we can't actually show.
        const url = r.link ?? r.product_link;
        const img = r.thumbnail;
        return (
          !!r.title &&
          !!url &&
          /^https?:\/\//.test(url) &&
          !!img &&
          /^https?:\/\//.test(img)
        );
      })
      .slice(0, maxCandidates())
      .map((r, i) => {
        const storeName = r.source ?? "Store";
        const source = inferSourceFromStore(storeName);
        const id =
          r.product_id ??
          `${encodeURIComponent(r.title!.slice(0, 40))}-${i}`.slice(0, 80);
        // Prefer the direct merchant link; fall back to the Google Shopping
        // product page (which always lists buyable sellers).
        const productUrl = r.link ?? r.product_link!;
        return {
          externalId: id,
          source,
          title: r.title!,
          price: r.extracted_price,
          currency:
            q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
          imageUrl: r.thumbnail!,
          productUrl,
          canonicalUrl: r.product_link ?? productUrl,
          category: q.category,
          storeName,
          // SerpAPI surfaces live Google Shopping listings — real, purchasable
          // products with real images. Trust as verified for the shop link.
          verified: true,
          availability: "in_stock",
          matchCategory: q.category,
          rating: r.rating,
        };
      });
  },
};

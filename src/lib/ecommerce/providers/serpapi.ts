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
      }>;
    };

    const results = data.shopping_results ?? [];
    return results
      .filter((r) => r.title && (r.product_link ?? r.link) && r.thumbnail)
      .slice(0, 6)
      .map((r, i) => {
        const storeName = r.source ?? "Store";
        const source = inferSourceFromStore(storeName);
        const id =
          r.product_id ??
          `${encodeURIComponent(r.title!.slice(0, 40))}-${i}`.slice(0, 80);
        return {
          externalId: id,
          source,
          title: r.title!,
          price: r.extracted_price,
          currency:
            q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
          imageUrl: r.thumbnail!,
          productUrl: r.product_link ?? r.link!,
          category: q.category,
          storeName,
          verified: true,
          availability: "in_stock",
          matchCategory: q.category,
        };
      });
  },
};

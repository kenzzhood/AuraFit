import type {
  NormalizedProduct,
  ProductQuery,
  ProductSearchProvider,
} from "./types";

function demoProductsForQuery(q: ProductQuery): NormalizedProduct[] {
  const slug =
    encodeURIComponent(q.query || "look").replace(/%/g, "").slice(0, 28) ||
    "demo";
  return [
    {
      externalId: `${slug}-top`,
      source: "demo",
      title: `Anchor piece — ${q.query.slice(0, 40) || "style"}`,
      price: q.budgetMin
        ? Math.min(q.budgetMax ?? 20000, q.budgetMin + 1500)
        : 2499,
      currency: q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
      productUrl: "https://www.example.com/product/demo-top",
      category: q.category,
      storeName: "Demo Store",
    },
    {
      externalId: `${slug}-bottom`,
      source: "demo",
      title: `Complement — ${q.category} pairing`,
      price: q.budgetMin
        ? Math.min(q.budgetMax ?? 20000, q.budgetMin + 800)
        : 1999,
      currency: q.region === "US" ? "USD" : q.region === "UK" ? "GBP" : "INR",
      productUrl: "https://www.example.com/product/demo-bottom",
      category: q.category === "top" ? "bottom" : "top",
      storeName: "Demo Store",
    },
  ];
}

export const demoProductProvider: ProductSearchProvider = {
  name: "demo",
  isConfigured: () => true,
  search: async (q) => demoProductsForQuery(q),
};

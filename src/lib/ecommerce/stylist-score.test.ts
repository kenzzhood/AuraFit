import { describe, expect, it } from "vitest";
import {
  brandScore,
  designScore,
  materialScore,
  priceScore,
  qualityScore,
  stylistGarmentScore,
} from "./stylist-score";
import type { Product } from "./product";

function p(partial: Partial<Product> & { title: string; url: string }): Product {
  return {
    externalId: partial.url,
    source: "index",
    currency: "INR",
    verified: true,
    availability: "in_stock",
    ...partial,
  };
}

describe("stylistGarmentScore", () => {
  it("prefers a linen shirt in-budget over a polyester one over budget", () => {
    const linen = p({
      title: "White linen oxford shirt",
      url: "https://www.myntra.com/1",
      price: 2200,
      rating: 4.4,
      brand: "Rare Rabbit",
    });
    const poly = p({
      title: "White polyester pack of shirts",
      url: "https://www.flipkart.com/p/itm1",
      price: 8999,
      rating: 2.8,
    });
    const ctx = {
      query: "white linen shirt",
      budgetMax: 4000,
      look: {
        label: "Crisp linen",
        productSearchQuery: "white linen shirt",
        items: [{ category: "top", description: "white linen shirt" }],
      },
    };
    expect(stylistGarmentScore(linen, ctx)).toBeGreaterThan(
      stylistGarmentScore(poly, ctx)
    );
  });

  it("scores fabric match higher when the look asked for linen", () => {
    const linen = p({
      title: "Navy linen shirt",
      url: "https://www.ajio.com/p/1",
    });
    const denim = p({
      title: "Navy denim shirt",
      url: "https://www.ajio.com/p/2",
    });
    const ctx = { query: "linen shirt" };
    expect(materialScore(linen, ctx)).toBeGreaterThan(materialScore(denim, ctx));
  });

  it("rewards in-range prices and named brands", () => {
    expect(priceScore(2500, 1000, 4000)).toBeGreaterThan(priceScore(9000, 1000, 4000));
    expect(brandScore(p({ title: "Shirt", url: "https://a.com/1", brand: "Snitch" }))).toBeGreaterThan(
      brandScore(p({ title: "Men pack shirt", url: "https://a.com/2" }))
    );
    expect(qualityScore(p({ title: "Organic cotton tailored shirt", url: "https://a.com/3", rating: 4.6 }))).toBeGreaterThan(
      qualityScore(p({ title: "Polyester costume shirt pack of 5", url: "https://a.com/4", rating: 2.1 }))
    );
    expect(
      designScore(p({ title: "White slim shirt", url: "https://a.com/5" }), {
        query: "white slim shirt",
      })
    ).toBeGreaterThan(0.7);
  });
});

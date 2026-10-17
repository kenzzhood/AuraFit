import { describe, expect, it } from "vitest";
import { filterIndexableProducts } from "./search";
import type { Product } from "@/lib/ecommerce/product";

const LIVE_BUY =
  "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy";

function product(partial: Partial<Product> & { title: string; url: string }): Product {
  return {
    externalId: partial.externalId ?? partial.url,
    source: partial.source ?? "index",
    currency: "INR",
    ...partial,
  };
}

describe("filterIndexableProducts", () => {
  it("drops snitch.co.in and snitch.com /products listings", () => {
    const kept = filterIndexableProducts([
      product({
        title: "Dead Shopify handle",
        url: "https://www.snitch.com/products/floral-midi",
      }),
      product({
        title: "Old .co.in row",
        url: "https://www.snitch.co.in/products/floral-midi",
      }),
      product({ title: "Live PDP", url: LIVE_BUY }),
      product({ title: "Myntra shirt", url: "https://www.myntra.com/p/1" }),
    ]);
    expect(kept.map((p) => p.title)).toEqual(["Live PDP", "Myntra shirt"]);
  });

  it("uses canonicalUrl ?? url so a live canonical keeps the row", () => {
    const kept = filterIndexableProducts([
      product({
        title: "Canonical rescue",
        url: "https://www.snitch.com/products/floral-midi",
        canonicalUrl: LIVE_BUY,
      }),
    ]);
    expect(kept).toHaveLength(1);
  });

  it("drops a row whose canonical is a dead /products path", () => {
    const kept = filterIndexableProducts([
      product({
        title: "Dead canonical",
        url: LIVE_BUY,
        canonicalUrl: "https://www.snitch.com/products/floral-midi",
      }),
    ]);
    expect(kept).toHaveLength(0);
  });
});

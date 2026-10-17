import { describe, expect, it } from "vitest";
import {
  diversifyByRetailer,
  hasMarketplaceCoverage,
  isBoutiqueRetailer,
  isCoreMarketplace,
  preferMarketplaceProducts,
} from "./retailer-diversity";
import type { Product } from "./product";

describe("diversifyByRetailer", () => {
  it("rotates stores so a boutique cannot occupy the whole top", () => {
    const items = [
      { url: "https://www.bananaclub.co.in/products/a", title: "A" },
      { url: "https://www.bananaclub.co.in/products/b", title: "B" },
      { url: "https://www.bananaclub.co.in/products/c", title: "C" },
      { url: "https://www.myntra.com/1/buy", title: "M" },
      { url: "https://www.amazon.in/dp/B000000001", title: "Am" },
      { url: "https://www.ajio.com/p/x", title: "Aj" },
    ];
    const out = diversifyByRetailer(items, (i) => i.url, { maxPerRetailer: 2 });
    const firstThree = out.slice(0, 3).map((i) => new URL(i.url).hostname);
    expect(firstThree.some((h) => h.includes("amazon"))).toBe(true);
    expect(firstThree.some((h) => h.includes("myntra"))).toBe(true);
    expect(out.filter((i) => i.url.includes("bananaclub"))).toHaveLength(2);
  });
});

describe("isCoreMarketplace", () => {
  it("recognizes Amazon, Myntra, Ajio, Flipkart", () => {
    expect(isCoreMarketplace("https://www.amazon.in/dp/1")).toBe(true);
    expect(isCoreMarketplace("https://www.myntra.com/x/buy")).toBe(true);
    expect(isCoreMarketplace("https://www.ajio.com/p/1")).toBe(true);
    expect(isCoreMarketplace("https://www.bananaclub.co.in/products/a")).toBe(
      false
    );
    expect(isBoutiqueRetailer("https://www.bananaclub.co.in/products/a")).toBe(
      true
    );
    expect(isBoutiqueRetailer("https://www.snitch.com/products/a")).toBe(true);
  });
});

function stub(url: string): Product {
  return {
    externalId: url,
    title: "Item",
    url,
    source: "crawl",
    currency: "INR",
    verified: true,
  };
}

describe("marketplace coverage", () => {
  it("rejects Flipkart + Banana Club as complete", () => {
    const pool = [
      stub("https://www.flipkart.com/p/itm1"),
      stub("https://www.bananaclub.co.in/products/a"),
      stub("https://www.bananaclub.co.in/products/b"),
      stub("https://www.bewakoof.com/p/1"),
    ];
    expect(hasMarketplaceCoverage(pool)).toBe(false);
  });

  it("accepts Amazon + Myntra + Ajio + Flipkart", () => {
    const pool = [
      stub("https://www.amazon.in/dp/B000000001"),
      stub("https://www.myntra.com/x/buy"),
      stub("https://www.ajio.com/p/1"),
      stub("https://www.flipkart.com/p/itm1"),
    ];
    expect(hasMarketplaceCoverage(pool)).toBe(true);
  });

  it("keeps boutique rows in the mix with marketplaces", () => {
    const out = preferMarketplaceProducts([
      stub("https://www.bananaclub.co.in/products/a"),
      stub("https://www.amazon.in/dp/B000000001"),
      stub("https://www.myntra.com/x/buy"),
      stub("https://www.ajio.com/p/1"),
      stub("https://www.zara.com/in/en/shirt-p1.html"),
    ]);
    expect(out.some((p) => p.url.includes("amazon.in"))).toBe(true);
    expect(out.some((p) => p.url.includes("bananaclub"))).toBe(true);
    expect(out.some((p) => p.url.includes("myntra"))).toBe(true);
  });
});

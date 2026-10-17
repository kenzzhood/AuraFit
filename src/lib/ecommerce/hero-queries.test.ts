import { describe, expect, it } from "vitest";
import { heroSearchVariants } from "./hero-queries";
import {
  currencyMatchesRegion,
  needsPdpVerification,
  regionTldScore,
} from "./buyability";
import type { Product } from "./product";

describe("heroSearchVariants", () => {
  it("returns the primary query plus an attribute-expanded variant", () => {
    const variants = heroSearchVariants({
      searchQuery: "evening look",
      category: "dress",
      style: "women",
      lookDescription: "navy midi linen dress",
      budgetMax: 4000,
    });
    expect(variants[0]).toMatch(/dress/i);
    expect(variants.some((q) => /navy/i.test(q) && /midi/i.test(q))).toBe(true);
    expect(variants.some((q) => /under 4000/.test(q))).toBe(true);
    expect(variants.length).toBeGreaterThanOrEqual(2);
    expect(variants.length).toBeLessThanOrEqual(3);
  });
});

describe("buyability", () => {
  it("drops USD listings for India", () => {
    expect(currencyMatchesRegion("USD", "IN")).toBe(false);
    expect(currencyMatchesRegion("INR", "IN")).toBe(true);
  });

  it("penalizes UK storefronts for Indian shoppers", () => {
    expect(regionTldScore("https://www.amazon.co.uk/dp/1", "IN")).toBe(0);
    expect(regionTldScore("https://www.myntra.com/p/1", "IN")).toBe(1);
  });

  it("trusts live listings, rechecks stale rows, always checks unverified rows", () => {
    // Live shopping listing straight from a merchant feed — no Playwright trip.
    const liveListing: Product = {
      externalId: "1",
      title: "Dress",
      url: "https://myntra.com/p/1",
      source: "serpapi",
      currency: "INR",
      verified: true,
      pdpVerified: false,
    };
    expect(needsPdpVerification(liveListing)).toBe(false);

    // Never-verified snippet — a PDP crawl is its only path to "verified".
    expect(
      needsPdpVerification({ ...liveListing, verified: false })
    ).toBe(true);

    // Freshly crawler-validated row — trusted.
    const fresh: Product = {
      ...liveListing,
      source: "crawl",
      pdpVerified: true,
      lastCrawledAt: new Date().toISOString(),
    };
    expect(needsPdpVerification(fresh)).toBe(false);

    // Crawler-validated 30 days ago — links rot, recheck.
    const stale: Product = {
      ...fresh,
      lastCrawledAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    };
    expect(needsPdpVerification(stale)).toBe(true);
  });
});

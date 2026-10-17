import { describe, expect, it } from "vitest";
import { UsedProductTracker, sampleTopK } from "./used-products";

describe("UsedProductTracker", () => {
  it("rejects the same URL twice", () => {
    const t = new UsedProductTracker(2);
    expect(t.tryClaim("https://myntra.com/p/1?foo=1", "Navy Polo")).toBe(true);
    expect(t.tryClaim("https://myntra.com/p/1", "Navy Polo")).toBe(false);
  });

  it("rejects near-duplicate titles across stores", () => {
    const t = new UsedProductTracker(2);
    expect(
      t.tryClaim("https://myntra.com/p/1", "Floral Midi Dress - Blue")
    ).toBe(true);
    expect(
      t.tryClaim("https://ajio.com/p/2", "Blue Floral Midi Dress")
    ).toBe(false);
  });

  it("caps items per retailer and relaxes on recovery", () => {
    const t = new UsedProductTracker(2);
    expect(t.tryClaim("https://myntra.com/a", "Navy Polo")).toBe(true);
    expect(t.tryClaim("https://myntra.com/b", "White Oxford")).toBe(true);
    expect(t.tryClaim("https://myntra.com/c", "Olive Overshirt")).toBe(false);
    expect(
      t.tryClaim("https://myntra.com/c", "Olive Overshirt", {
        relaxRetailerCap: true,
      })
    ).toBe(true);
  });

  it("release frees URL, fingerprint, and retailer count", () => {
    const t = new UsedProductTracker(1);
    t.tryClaim("https://myntra.com/a", "Navy Polo");
    t.release("https://myntra.com/a", "Navy Polo");
    expect(t.tryClaim("https://myntra.com/b", "White Oxford")).toBe(true);
  });

  it("burn blocks a dead listing without consuming the retailer cap", () => {
    const t = new UsedProductTracker(1);
    t.burn("https://myntra.com/dead");
    expect(t.tryClaim("https://myntra.com/dead", "Ghost Dress")).toBe(false);
    expect(t.tryClaim("https://myntra.com/live", "Real Dress")).toBe(true);
  });
});

describe("sampleTopK", () => {
  it("keeps remaining items after the shuffled head", () => {
    const out = sampleTopK([1, 2, 3, 4, 5], 3);
    expect(out).toHaveLength(5);
    expect(out.slice(3)).toEqual([4, 5]);
    expect(new Set(out.slice(0, 3))).toEqual(new Set([1, 2, 3]));
  });
});

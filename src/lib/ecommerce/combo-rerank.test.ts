import { describe, expect, it } from "vitest";
import { rerankOutfitCombos, scoreOutfitCombo } from "./combo-rerank";
import type { Product } from "./product";

function product(partial: Partial<Product> & { title: string; url: string }): Product {
  return {
    externalId: partial.externalId ?? partial.url,
    source: partial.source ?? "index",
    currency: "INR",
    verified: true,
    ...partial,
  };
}

describe("scoreOutfitCombo", () => {
  it("prefers looks that stay under budget", () => {
    const cheap = [
      product({ title: "Navy midi dress", url: "https://a.com/1", price: 2000 }),
      product({ title: "Tan sandals", url: "https://b.com/2", price: 1500 }),
    ];
    const pricey = [
      product({ title: "Navy midi dress", url: "https://a.com/1", price: 9000 }),
      product({ title: "Tan sandals", url: "https://b.com/2", price: 8000 }),
    ];
    expect(scoreOutfitCombo(cheap, { budgetMax: 5000 })).toBeGreaterThan(
      scoreOutfitCombo(pricey, { budgetMax: 5000 })
    );
  });
});

describe("rerankOutfitCombos", () => {
  it("swaps in a better color-coherent combo when the gain is large", () => {
    const navyDress = product({
      title: "Navy midi dress",
      url: "https://myntra.com/d1",
      colors: ["navy"],
      price: 2500,
    });
    const neonDress = product({
      title: "Neon orange bodycon dress",
      url: "https://myntra.com/d2",
      colors: ["orange"],
      price: 2500,
    });
    const navyHeel = product({
      title: "Navy block heels",
      url: "https://ajio.com/s1",
      colors: ["navy"],
      price: 1800,
    });

    const picked = rerankOutfitCombos(
      [
        { category: "dress", candidates: [neonDress, navyDress] },
        { category: "shoes", candidates: [navyHeel] },
      ],
      { bestColors: ["navy"], budgetMax: 6000 }
    );

    expect(picked[0]?.url).toBe(navyDress.url);
    expect(picked[1]?.url).toBe(navyHeel.url);
  });

  it("keeps rank order when scores are close", () => {
    const a = product({ title: "White shirt", url: "https://a.com/1", price: 1000 });
    const b = product({ title: "White shirt two", url: "https://a.com/2", price: 1100 });
    const pants = product({ title: "Beige chinos", url: "https://b.com/3", price: 1500 });
    const picked = rerankOutfitCombos([
      { category: "top", candidates: [a, b] },
      { category: "bottom", candidates: [pants] },
    ]);
    expect(picked[0]?.url).toBe(a.url);
  });

  it("aligns empty slots as undefined", () => {
    const dress = product({ title: "Midi dress", url: "https://a.com/1" });
    const picked = rerankOutfitCombos([
      { category: "dress", candidates: [dress] },
      { category: "shoes", candidates: [] },
    ]);
    expect(picked).toHaveLength(2);
    expect(picked[0]?.url).toBe(dress.url);
    expect(picked[1]).toBeUndefined();
  });
});

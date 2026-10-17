import { describe, expect, it } from "vitest";
import { titleFingerprint } from "./fingerprint";
import { dedupeProducts } from "./dedupe";
import type { Product } from "./product";

function product(partial: Partial<Product> & { title: string; url: string }): Product {
  return {
    externalId: partial.externalId ?? partial.url,
    source: partial.source ?? "index",
    currency: "INR",
    ...partial,
  };
}

describe("titleFingerprint", () => {
  it("collapses word-order variants of the same dress", () => {
    expect(titleFingerprint("Floral Midi Dress - Blue")).toBe(
      titleFingerprint("Blue Floral Midi Dress")
    );
  });

  it("strips size and gender tokens", () => {
    expect(titleFingerprint("Navy Polo Shirt Men XL")).toBe(
      titleFingerprint("Navy Polo Shirt")
    );
  });

  it("keeps color so different garments stay distinct", () => {
    expect(titleFingerprint("Navy Polo Shirt")).not.toBe(
      titleFingerprint("White Polo Shirt")
    );
  });
});

describe("dedupeProducts", () => {
  it("dedupes the same dress listed with shuffled title words", () => {
    const out = dedupeProducts([
      product({
        title: "Floral Midi Dress - Blue",
        url: "https://myntra.com/p/1",
        price: 1999,
      }),
      product({
        title: "Blue Floral Midi Dress",
        url: "https://ajio.com/p/2",
        price: 1899,
      }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps distinct products", () => {
    const out = dedupeProducts([
      product({ title: "Navy Polo Shirt", url: "https://a.com/1" }),
      product({ title: "White Oxford Shirt", url: "https://a.com/2" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

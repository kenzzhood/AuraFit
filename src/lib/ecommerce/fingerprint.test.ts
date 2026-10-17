import { describe, expect, it } from "vitest";
import {
  isIndexableProductUrl,
  isUsableShopUrl,
  isUsableSnitchProductUrl,
  normalizeProductUrl,
  pickUsableShopUrl,
  rewriteLegacyRetailerUrl,
  unwrapMerchantUrl,
  usableMerchantUrl,
} from "./fingerprint";

const NEW_SHAPE_PDP =
  "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy";

describe("rewriteLegacyRetailerUrl", () => {
  it("rewrites snitch.co.in to snitch.com keeping path and query", () => {
    expect(
      rewriteLegacyRetailerUrl(
        "https://www.snitch.co.in/products/slim-fit-shirt?color=navy"
      )
    ).toBe("https://www.snitch.com/products/slim-fit-shirt?color=navy");
  });

  it("leaves snitch.com and other hosts unchanged", () => {
    expect(rewriteLegacyRetailerUrl(NEW_SHAPE_PDP)).toBe(NEW_SHAPE_PDP);
    expect(rewriteLegacyRetailerUrl("https://www.myntra.com/p/1")).toBe(
      "https://www.myntra.com/p/1"
    );
  });
});

describe("isUsableSnitchProductUrl", () => {
  it("accepts the live PDP shape /<category>/<handle>/<numericId>/buy", () => {
    expect(isUsableSnitchProductUrl(NEW_SHAPE_PDP)).toBe(true);
    expect(
      isUsableSnitchProductUrl(
        "https://www.snitch.com/men-tshirts/oversized-tee-4msst123-01/1234/buy?size=m"
      )
    ).toBe(true);
  });

  it("rejects Shopify-era /products/<handle> paths (dead on snitch.com)", () => {
    expect(
      isUsableSnitchProductUrl("https://www.snitch.com/products/floral-midi")
    ).toBe(false);
    expect(
      isUsableSnitchProductUrl("https://www.snitch.co.in/products/floral-midi")
    ).toBe(false);
  });

  it("rejects listing-shaped anchors without a numeric id", () => {
    expect(
      isUsableSnitchProductUrl("https://www.snitch.com/men-accessories/buy")
    ).toBe(false);
    expect(
      isUsableSnitchProductUrl(
        "https://www.snitch.com/men-shirts/regular-fit-black-shirt/buy"
      )
    ).toBe(false);
    expect(
      isUsableSnitchProductUrl(
        "https://www.snitch.com/men-shirts/shirt/9269896904866"
      )
    ).toBe(false);
  });

  it("rejects splash URLs, snitch.co.in, and other hosts", () => {
    expect(isUsableSnitchProductUrl("https://www.snitch.co.in/")).toBe(false);
    expect(isUsableSnitchProductUrl("https://www.snitch.com/")).toBe(false);
    expect(isUsableSnitchProductUrl("https://www.snitch.com/products")).toBe(
      false
    );
    expect(
      isUsableSnitchProductUrl("https://www.snitch.co.in/x/y/123/buy")
    ).toBe(false);
    expect(
      isUsableSnitchProductUrl("https://www.myntra.com/a/b/123/buy")
    ).toBe(false);
  });
});

describe("usableMerchantUrl", () => {
  it("always nulls snitch.co.in URLs — old handles cannot be mapped", () => {
    expect(
      usableMerchantUrl("https://www.snitch.co.in/products/slim-fit-shirt")
    ).toBeNull();
    expect(usableMerchantUrl("https://www.snitch.co.in/")).toBeNull();
    expect(
      usableMerchantUrl("https://www.snitch.co.in/x/y/123/buy")
    ).toBeNull();
  });

  it("keeps snitch.com URLs only when they are live PDPs", () => {
    expect(usableMerchantUrl(NEW_SHAPE_PDP)).toBe(NEW_SHAPE_PDP);
    expect(
      usableMerchantUrl("https://www.snitch.com/products/slim-fit-shirt")
    ).toBeNull();
    expect(
      usableMerchantUrl("https://www.snitch.com/men-accessories/buy")
    ).toBeNull();
  });

  it("passes other retailers through unchanged", () => {
    expect(usableMerchantUrl("https://www.myntra.com/p/1")).toBe(
      "https://www.myntra.com/p/1"
    );
  });

  it("unwraps a Google /url?q= wrapper to the merchant URL", () => {
    const merchant = "https://www.myntra.com/dresses/floral-midi/123/buy";
    const wrapped = `https://www.google.com/url?q=${encodeURIComponent(merchant)}&sa=U`;
    expect(unwrapMerchantUrl(wrapped)).toBe(merchant);
    expect(usableMerchantUrl(wrapped)).toBe(merchant);
    expect(unwrapMerchantUrl(`/url?q=${encodeURIComponent(merchant)}`)).toBe(merchant);
  });

  it("unwraps a double-encoded q value", () => {
    const merchant = "https://www.myntra.com/dresses/floral-midi/123/buy";
    const once = encodeURIComponent(merchant);
    const twice = encodeURIComponent(once);
    const wrapped = `https://www.google.com/url?q=${twice}`;
    expect(unwrapMerchantUrl(wrapped)).toBe(merchant);
    expect(usableMerchantUrl(wrapped)).toBe(merchant);
  });

  it("rejects truncated non-URLs and leftover Google hosts", () => {
    expect(unwrapMerchantUrl("not a url")).toBeNull();
    expect(usableMerchantUrl("https://www.myntra.com/%")).toBeNull();
    expect(usableMerchantUrl("https://www.google.com/search?q=dress")).toBeNull();
    expect(usableMerchantUrl("https://www.google.com/url?q=")).toBeNull();
  });

  it("still drops dead Snitch after unwrapping a wrapper", () => {
    const dead = "https://www.snitch.com/products/floral-midi";
    const wrapped = `https://www.google.com/url?q=${encodeURIComponent(dead)}`;
    expect(usableMerchantUrl(wrapped)).toBeNull();
    expect(usableMerchantUrl(NEW_SHAPE_PDP)).toBe(NEW_SHAPE_PDP);
    const liveWrapped = `https://www.google.com/url?q=${encodeURIComponent(NEW_SHAPE_PDP)}`;
    expect(usableMerchantUrl(liveWrapped)).toBe(NEW_SHAPE_PDP);
    expect(
      usableMerchantUrl(
        "https://www.google.com/url?q=" +
          encodeURIComponent("https://www.snitch.co.in/products/old")
      )
    ).toBeNull();
  });
});

describe("isUsableShopUrl", () => {
  it("is true when usableMerchantUrl returns a URL", () => {
    expect(isUsableShopUrl(NEW_SHAPE_PDP)).toBe(true);
    expect(isUsableShopUrl("https://www.myntra.com/p/1")).toBe(true);
  });

  it("is false for dead Snitch even when the host looks current", () => {
    expect(
      isUsableShopUrl("https://www.snitch.com/products/floral-midi")
    ).toBe(false);
    expect(
      isUsableShopUrl("https://www.snitch.co.in/products/floral-midi")
    ).toBe(false);
  });
});

describe("pickUsableShopUrl", () => {
  it("returns the first usable URL and skips dead Snitch", () => {
    expect(
      pickUsableShopUrl(
        "https://www.snitch.com/products/floral-midi",
        undefined,
        NEW_SHAPE_PDP
      )
    ).toBe(NEW_SHAPE_PDP);
    expect(
      pickUsableShopUrl("https://www.myntra.com/p/1", NEW_SHAPE_PDP)
    ).toBe("https://www.myntra.com/p/1");
  });

  it("returns null when every candidate is unusable", () => {
    expect(
      pickUsableShopUrl(
        "https://www.snitch.co.in/products/foo",
        "https://www.snitch.com/products/foo"
      )
    ).toBeNull();
    expect(pickUsableShopUrl(undefined, null, "")).toBeNull();
  });
});

describe("isIndexableProductUrl", () => {
  it("aliases isUsableShopUrl", () => {
    expect(isIndexableProductUrl(NEW_SHAPE_PDP)).toBe(
      isUsableShopUrl(NEW_SHAPE_PDP)
    );
    expect(
      isIndexableProductUrl("https://www.snitch.com/products/floral-midi")
    ).toBe(false);
    expect(isIndexableProductUrl("https://www.myntra.com/p/1")).toBe(true);
  });
});

describe("normalizeProductUrl", () => {
  it("dedupes snitch.co.in and snitch.com listings", () => {
    expect(
      normalizeProductUrl("https://www.snitch.co.in/products/foo?x=1")
    ).toBe(normalizeProductUrl("https://www.snitch.com/products/foo?y=2"));
  });
});

import { describe, expect, it } from "vitest";
import { rescueSnitchProductUrl } from "./affiliate";
import { rewriteLegacyRetailerUrl } from "./fingerprint";

const NEW_SHAPE_PDP =
  "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy";

describe("rescueSnitchProductUrl", () => {
  it("does not rewrite dead /products/<handle> paths to on-site search", () => {
    const dead =
      "https://www.snitch.com/products/blend-regular-fit-shirt-4sfs012-07";
    expect(rescueSnitchProductUrl(dead)).toBe(dead);
    expect(rescueSnitchProductUrl(dead)).not.toMatch(/snitch\.com\/search/);
  });

  it("does not treat host-rewrite of old .co.in rows as rescue", () => {
    const original =
      "https://www.snitch.co.in/products/blend-regular-fit-shirt-4sfs012-07";
    expect(rescueSnitchProductUrl(original)).toBe(original);
    expect(
      rescueSnitchProductUrl(rewriteLegacyRetailerUrl(original))
    ).not.toMatch(/snitch\.com\/search/);
    expect(
      rescueSnitchProductUrl(rewriteLegacyRetailerUrl(original))
    ).not.toMatch(/\/search\?q=/);
  });

  it("does not invent a search URL from sku-ish /products handles", () => {
    const dead = "https://www.snitch.com/products/oversized-tee-4msst123-01";
    expect(rescueSnitchProductUrl(dead)).toBe(dead);
    expect(rescueSnitchProductUrl(dead)).not.toBe(
      "https://www.snitch.com/search?q=oversized%20tee"
    );
  });

  it("passes a live /buy PDP through untouched", () => {
    expect(rescueSnitchProductUrl(NEW_SHAPE_PDP)).toBe(NEW_SHAPE_PDP);
  });

  it("leaves non-/products Snitch paths and other retailers alone", () => {
    expect(
      rescueSnitchProductUrl("https://www.snitch.com/men-accessories/buy")
    ).toBe("https://www.snitch.com/men-accessories/buy");
    expect(rescueSnitchProductUrl("https://www.myntra.com/p/1")).toBe(
      "https://www.myntra.com/p/1"
    );
  });
});

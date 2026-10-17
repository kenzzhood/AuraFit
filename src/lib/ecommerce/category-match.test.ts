import { describe, expect, it } from "vitest";
import {
  canonicalItemCategory,
  genericSlotQueries,
  productMatchesSlot,
  slotSearchQuery,
  slotSearchVariants,
} from "./category-match";

describe("productMatchesSlot", () => {
  it("rejects chinos for top slot", () => {
    expect(
      productMatchesSlot("Navy Blue Plain Pleated Chinos", "bottom", "top")
    ).toBe(false);
    expect(
      productMatchesSlot("Baggy Fit Olive Green Chinos", undefined, "top")
    ).toBe(false);
  });

  it("accepts shirts and polos for top slot", () => {
    expect(
      productMatchesSlot("Navy Blue Polo Shirt Men", undefined, "top")
    ).toBe(true);
    expect(
      productMatchesSlot("White Cotton Dress Shirt", "top", "top")
    ).toBe(true);
  });

  it("accepts trousers for bottom slot", () => {
    expect(
      productMatchesSlot("Charcoal Grey Button-Tab Pleat Trouser", undefined, "bottom")
    ).toBe(true);
  });

  it("rejects shirts for bottom slot", () => {
    expect(
      productMatchesSlot("Maroon Long Sleeve Shirt", undefined, "bottom")
    ).toBe(false);
  });

  it("accepts overshirts for outerwear", () => {
    expect(
      productMatchesSlot("Olive Green Overshirt Men", undefined, "outerwear")
    ).toBe(true);
  });

  it("rejects chinos for outerwear even when meta says outerwear", () => {
    expect(
      productMatchesSlot("Navy Blue Plain Pleated Chinos", "outerwear", "outerwear")
    ).toBe(false);
  });
});

describe("slotSearchQuery", () => {
  it("adds garment hint when query is outfit-level", () => {
    expect(slotSearchQuery("smart utility chic", "top", "men")).toMatch(/shirt/i);
    expect(slotSearchQuery("navy slim polo men", "top")).not.toMatch(/shirt shirt/i);
  });
});

describe("genericSlotQueries", () => {
  it("uses oxford/linen/blazer queries for old money, not polo/tee/chinos", () => {
    const top = genericSlotQueries("top", "old money")[0] ?? "";
    const bottom = genericSlotQueries("bottom", "old money")[0] ?? "";
    const outer = genericSlotQueries("outerwear", "old money")[0] ?? "";
    expect(top).not.toMatch(/polo|cotton tshirt|t-shirt/i);
    expect(bottom).not.toMatch(/chinos/i);
    expect(top).toMatch(/oxford|linen/i);
    expect(bottom).toMatch(/wool|pleated/i);
    expect(outer).toMatch(/blazer/i);
  });

  it("keeps polo or tshirt / chinos for weekend casual", () => {
    const top = genericSlotQueries("top", "weekend casual")[0] ?? "";
    const bottom = genericSlotQueries("bottom", "weekend casual")[0] ?? "";
    expect(top).toMatch(/polo|tshirt|t-shirt|tee/i);
    expect(bottom).toMatch(/chinos/i);
  });
});

describe("slotSearchVariants", () => {
  it("prefers the LLM searchQuery, then generic fallback, capped at 2", () => {
    const variants = slotSearchVariants({
      category: "outerwear",
      searchQuery: "navy wool blazer",
      style: "old money",
    });
    expect(variants[0]).toBe("navy wool blazer");
    expect(variants.length).toBeLessThanOrEqual(2);
    expect(variants[0]).not.toMatch(/overshirt/i);
  });

  it("tries a broad slot query before the planned garment name", () => {
    const variants = slotSearchVariants({
      category: "top",
      searchQuery: "cream linen camp collar shirt",
      style: "weekend casual",
      broadFirst: true,
    });
    expect(variants[0]).toMatch(/polo|tshirt|t-shirt|tee/i);
    expect(variants[1]).toBe("cream linen camp collar shirt");
    expect(variants[0]).not.toBe(variants[1]);
  });
});

describe("canonicalItemCategory", () => {
  it("maps chinos to bottom", () => {
    expect(canonicalItemCategory("chinos")).toBe("bottom");
  });

  it("treats midi/maxi/bodycon/wrap as dress unless another slot is clear", () => {
    expect(canonicalItemCategory("Floral Maxi")).toBe("dress");
    expect(canonicalItemCategory("Bodycon Midi")).toBe("dress");
    expect(canonicalItemCategory("mini skirt")).toBe("bottom");
    expect(canonicalItemCategory("wrap shirt")).toBe("top");
    expect(canonicalItemCategory("dress shirt")).toBe("top");
  });
});

describe("productMatchesSlot dress-like titles", () => {
  it("accepts Floral Maxi / Bodycon Midi for dress", () => {
    expect(productMatchesSlot("Floral Maxi", undefined, "dress")).toBe(true);
    expect(productMatchesSlot("Bodycon Midi", undefined, "dress")).toBe(true);
  });

  it("keeps mini skirt as bottom and wrap/dress shirts as tops", () => {
    expect(productMatchesSlot("mini skirt", undefined, "dress")).toBe(false);
    expect(productMatchesSlot("mini skirt", undefined, "bottom")).toBe(true);
    expect(productMatchesSlot("Mini Skirt", undefined, "dress")).toBe(false);
    expect(productMatchesSlot("Mini Skirt", undefined, "bottom")).toBe(true);
    expect(productMatchesSlot("wrap shirt", undefined, "top")).toBe(true);
    expect(productMatchesSlot("White Cotton Dress Shirt", "top", "top")).toBe(
      true
    );
    expect(
      productMatchesSlot("White Cotton Dress Shirt", undefined, "dress")
    ).toBe(false);
  });
});

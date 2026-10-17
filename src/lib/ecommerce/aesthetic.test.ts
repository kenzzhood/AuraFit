import { describe, expect, it } from "vitest";
import {
  aestheticNeedsOuterwear,
  classifyFashionAesthetic,
  fallbackLookItems,
  joinShoppingStyle,
} from "./aesthetic";

describe("classifyFashionAesthetic", () => {
  it("maps named aesthetics to buckets", () => {
    expect(classifyFashionAesthetic("old money")).toBe("old_money");
    expect(classifyFashionAesthetic("office party")).toBe("dressy");
    expect(classifyFashionAesthetic("Partywear")).toBe("dressy");
    expect(classifyFashionAesthetic("simply casual smart")).toBe("smart");
    expect(classifyFashionAesthetic("Smart casual")).toBe("smart");
    expect(classifyFashionAesthetic("Formal")).toBe("formal");
  });

  it("checks dressy office party before bare office as smart", () => {
    expect(classifyFashionAesthetic("office")).toBe("smart");
    expect(classifyFashionAesthetic("office party")).toBe("dressy");
  });

  it("defaults unset text to smart", () => {
    expect(classifyFashionAesthetic("")).toBe("smart");
  });

  it("keeps semi-formal as smart, not formal", () => {
    expect(classifyFashionAesthetic("semi-formal")).toBe("smart");
  });
});

describe("aestheticNeedsOuterwear", () => {
  it("is true only for dressy, old_money, and formal", () => {
    expect(aestheticNeedsOuterwear("dressy")).toBe(true);
    expect(aestheticNeedsOuterwear("old_money")).toBe(true);
    expect(aestheticNeedsOuterwear("formal")).toBe(true);
    expect(aestheticNeedsOuterwear("casual")).toBe(false);
    expect(aestheticNeedsOuterwear("smart")).toBe(false);
    expect(aestheticNeedsOuterwear("street")).toBe(false);
    expect(aestheticNeedsOuterwear("ethnic")).toBe(false);
  });
});

describe("joinShoppingStyle", () => {
  it("joins unique trimmed parts", () => {
    expect(
      joinShoppingStyle({
        styleType: "old money",
        occasion: "wedding",
        style: "old money",
      })
    ).toBe("old money wedding");
  });

  it("does not double-join a style that already concatenates styleType and occasion", () => {
    expect(
      joinShoppingStyle({
        styleType: "old money",
        occasion: "wedding",
        style: "old money wedding",
      })
    ).toBe("old money wedding");
  });

  it("skips empty and dedups case-insensitively", () => {
    expect(
      joinShoppingStyle({
        styleType: "  ",
        occasion: "Office Party",
        style: "office party",
      })
    ).toBe("Office Party");
  });
});

describe("fallbackLookItems", () => {
  it("gives old_money outerwear and not a polo-first top", () => {
    const items = fallbackLookItems("old_money", "men", 0);
    expect(items.some((i) => i.category === "outerwear")).toBe(true);
    const top = items.find((i) => i.category === "top");
    expect(top?.searchQuery).not.toMatch(/polo|tshirt|t-shirt|\btee\b/i);
    expect(top?.searchQuery).toMatch(/oxford|linen/i);
  });
});

import { describe, expect, it } from "vitest";
import {
  fallbackItemSearchQuery,
  lookPlannerSystemPrompt,
  normalizeCategory,
  padLooksToCount,
  resolveLookCount,
} from "./azure";

describe("normalizeCategory", () => {
  it("maps midi and Floral Maxi to dress", () => {
    expect(normalizeCategory("midi")).toBe("dress");
    expect(normalizeCategory("Floral Maxi")).toBe("dress");
  });

  it("maps kurta to dress", () => {
    expect(normalizeCategory("kurta")).toBe("dress");
  });

  it("keeps dress shirt and wrap shirt as top", () => {
    expect(normalizeCategory("dress shirt")).toBe("top");
    expect(normalizeCategory("wrap shirt")).toBe("top");
  });
});

describe("fallbackItemSearchQuery", () => {
  it("joins description and category without a hardcoded gender", () => {
    const q = fallbackItemSearchQuery("Floral Maxi", "dress");
    expect(q).toBe("Floral Maxi dress");
    expect(q).not.toMatch(/\bmen\b/i);
  });
});

describe("resolveLookCount", () => {
  it("defaults to 6 when unset", () => {
    expect(resolveLookCount()).toBe(6);
    expect(resolveLookCount({})).toBe(6);
  });

  it("honors 2, 3, and 6", () => {
    expect(resolveLookCount({ lookCount: 2 })).toBe(2);
    expect(resolveLookCount({ lookCount: 3 })).toBe(3);
    expect(resolveLookCount({ lookCount: 6 })).toBe(6);
  });
});

describe("lookPlannerSystemPrompt", () => {
  it("requires named aesthetics, distinct silhouettes, and outerwear when formal", () => {
    const prompt = lookPlannerSystemPrompt(6);
    expect(prompt).toMatch(/old money.*chinos/i);
    expect(prompt).toMatch(/office party.*polo/i);
    expect(prompt).toMatch(/silhouette/i);
    expect(prompt).toMatch(/outerwear/i);
    expect(prompt).toMatch(/blazer/i);
  });
});

describe("padLooksToCount", () => {
  it("pads short plans and slices long ones", () => {
    const plan = [{ label: "A" }, { label: "B" }];
    expect(padLooksToCount(plan, 3).map((l) => l.label)).toEqual([
      "A",
      "B",
      "Look 3",
    ]);
    expect(padLooksToCount(plan, 2)).toHaveLength(2);
    expect(
      padLooksToCount(
        [...plan, { label: "C" }, { label: "D" }, { label: "E" }, { label: "F" }],
        3
      )
    ).toHaveLength(3);
  });
});

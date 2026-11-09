import { describe, expect, it } from "vitest";
import { budgetForPrice, type Look } from "@/modules/shared/types";
import { assertNoToneLanguage, publicReason, recommend } from "./index";

function look(partial: Partial<Look> & Pick<Look, "id" | "color" | "priceInr">): Look {
  const priceInr = partial.priceInr;
  return {
    name: partial.id,
    nameTa: partial.id,
    availability: "available",
    availabilityText: "Available",
    location: "Floor 1 · Ethnic · Rack W3",
    fabric: "Cotton",
    care: "Dry clean",
    category: "kurta",
    modelOnly: false,
    caption: "Shown on a model like you",
    audience: "women",
    occasions: ["wedding"],
    budget: budgetForPrice(priceInr),
    priority: 0,
    popularity: 1,
    ...partial,
    priceInr,
  };
}

describe("recommendation", () => {
  const catalogue = [
    look({ id: "maroon", color: "maroon", priceInr: 12000, popularity: 2 }),
    look({ id: "ivory", color: "ivory", priceInr: 11000, popularity: 2 }),
    look({ id: "sand", color: "sand", priceInr: 13000, popularity: 1 }),
    look({ id: "indigo", color: "indigo", priceInr: 14000, popularity: 1 }),
    look({ id: "green", color: "green", priceInr: 15000, popularity: 1 }),
    look({ id: "black", color: "black", priceInr: 16000, popularity: 1 }),
    look({
      id: "pushed-a",
      color: "maroon",
      priceInr: 18000,
      priority: 3,
      popularity: 9,
    }),
    look({
      id: "pushed-b",
      color: "ivory",
      priceInr: 19000,
      priority: 3,
      popularity: 9,
    }),
    look({
      id: "pushed-c",
      color: "sand",
      priceInr: 20000,
      priority: 3,
      popularity: 9,
    }),
    look({
      id: "missing",
      color: "black",
      priceInr: 21000,
      availability: "ask_staff",
      availabilityText: "Ask staff",
      popularity: 10,
    }),
    look({
      id: "office",
      color: "indigo",
      priceInr: 2000,
      occasions: ["office"],
      audience: "women",
    }),
  ];

  it("returns at most six looks, keeps an unconfirmed item out of slot one, and hides tone", () => {
    const result = recommend(catalogue, {
      audience: "women",
      occasion: "wedding",
      budget: "5000_plus",
      color: null,
      tone: "t3",
    });
    expect(result.looks.length).toBeLessThanOrEqual(6);
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.looks[0].availability).not.toBe("ask_staff");
    expect(result.looks.filter((item) => item.id.startsWith("pushed")).length).toBeLessThanOrEqual(
      2
    );
    expect(() => assertNoToneLanguage(result.looks)).not.toThrow();
    expect(publicReason(["occasion", "tone_compat"])).not.toMatch(/tone|fair|dark/i);
    expect(result.debug.some((row) => row.factors.includes("tone_compat"))).toBe(true);
  });

  it("does not recommend another audience or budget", () => {
    const result = recommend(catalogue, {
      audience: "men",
      occasion: "wedding",
      budget: "5000_plus",
      color: null,
      tone: null,
    });
    expect(result.looks).toEqual([]);
  });
});

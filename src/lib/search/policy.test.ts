import { describe, expect, it } from "vitest";
import { googleShoppingAllowed, paidSearchAllowed } from "./policy";

describe("search policy", () => {
  it("keeps paid search and Google Shopping off unless explicitly allowed", () => {
    expect(paidSearchAllowed({})).toBe(false);
    expect(googleShoppingAllowed({})).toBe(false);
    expect(paidSearchAllowed({ AURAFIT_ALLOW_PAID_SEARCH: "true" })).toBe(true);
    expect(googleShoppingAllowed({ AURAFIT_ALLOW_GOOGLE_SHOPPING: "true" })).toBe(
      true
    );
    expect(paidSearchAllowed({ SERPAPI_KEY: "present", SERPAPI_ENABLED: "true" })).toBe(
      false
    );
  });
});

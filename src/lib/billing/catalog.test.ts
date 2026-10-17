import { describe, expect, it } from "vitest";
import {
  BILLING_CATALOG,
  formatMoney,
  getCatalogItem,
  planQuotas,
  trialDays,
} from "./catalog";

describe("billing catalog", () => {
  it("keeps free tier at zero price with a board allowance", () => {
    const free = getCatalogItem("free");
    expect(free?.amountMinor).toBe(0);
    expect(free?.boards).toBe(2);
  });

  it("prices Plus monthly INR at ₹199 (sweet spot)", () => {
    const plus = getCatalogItem("plus_month_inr");
    expect(plus?.amountMinor).toBe(19900);
    expect(formatMoney(plus!.amountMinor, "INR")).toMatch(/199/);
  });

  it("prices Pro monthly INR at ₹499", () => {
    const pro = getCatalogItem("pro_month_inr");
    expect(pro?.amountMinor).toBe(49900);
  });

  it("prices USD Plus at $4.99", () => {
    const plus = getCatalogItem("plus_month_usd");
    expect(plus?.amountMinor).toBe(499);
    expect(formatMoney(plus!.amountMinor, "USD")).toMatch(/4\.99/);
  });

  it("resolves plan quotas from catalog keys", () => {
    expect(planQuotas("plus_month_inr").boards).toBe(12);
    expect(planQuotas("pro_month_inr").boards).toBe(35);
    expect(planQuotas("pro_month_inr").hdRenders).toBe(15);
    expect(planQuotas("unknown").tier).toBe("free");
  });

  it("defaults trial to 7 days", () => {
    expect(trialDays()).toBeGreaterThanOrEqual(0);
    expect(trialDays()).toBeLessThanOrEqual(30);
  });

  it("never exposes negative prices", () => {
    for (const item of Object.values(BILLING_CATALOG)) {
      expect(item.amountMinor).toBeGreaterThanOrEqual(0);
    }
  });
});

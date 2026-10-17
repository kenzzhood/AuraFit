import { describe, expect, it } from "vitest";
import { isAllowedAffiliateUrl } from "./affiliate-url";

describe("isAllowedAffiliateUrl", () => {
  it("allows https retailer urls", () => {
    expect(isAllowedAffiliateUrl("https://www.snitch.com/products/x")).toBe(true);
    expect(isAllowedAffiliateUrl("https://www.snitch.co.in/products/x")).toBe(true);
  });

  it("rejects javascript and data schemes", () => {
    expect(isAllowedAffiliateUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAffiliateUrl("data:text/html,hi")).toBe(false);
  });

  it("rejects non-https, local, IP, and unknown hosts", () => {
    expect(isAllowedAffiliateUrl("http://www.amazon.in/dp/1")).toBe(false);
    expect(isAllowedAffiliateUrl("https://localhost/evil")).toBe(false);
    expect(isAllowedAffiliateUrl("https://10.0.0.1/x")).toBe(false);
    expect(isAllowedAffiliateUrl("https://evil.example/phish")).toBe(false);
    expect(isAllowedAffiliateUrl("not-a-url")).toBe(false);
  });
});

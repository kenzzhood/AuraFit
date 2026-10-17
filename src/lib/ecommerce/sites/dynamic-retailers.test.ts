import { describe, expect, it } from "vitest";
import {
  sanitizeRetailerSites,
  staticFallbackSites,
} from "./dynamic-retailers";

describe("sanitizeRetailerSites", () => {
  it("keeps valid https templates with {query}", () => {
    const sites = sanitizeRetailerSites([
      {
        name: "Nordstrom",
        domain: "nordstrom.com",
        searchUrlTemplate: "https://www.nordstrom.com/sr?keyword={query}",
      },
    ]);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.domain).toBe("nordstrom.com");
  });

  it("rejects localhost, IMDS, domain mismatch, and missing placeholders", () => {
    const sites = sanitizeRetailerSites([
      {
        name: "Bad",
        domain: "localhost",
        searchUrlTemplate: "http://localhost/search?q={query}",
      },
      {
        name: "IMDS",
        domain: "169.254.169.254",
        searchUrlTemplate: "https://169.254.169.254/latest/{query}",
      },
      {
        name: "Mismatch",
        domain: "amazon.in",
        searchUrlTemplate: "https://evil.example/search?q={query}",
      },
      {
        name: "NoPlaceholder",
        domain: "example.com",
        searchUrlTemplate: "https://example.com/search",
      },
    ]);
    expect(sites).toHaveLength(0);
  });

  it("accepts {slug_query} for slug-based retailers", () => {
    const sites = sanitizeRetailerSites([
      {
        name: "Myntra",
        domain: "myntra.com",
        searchUrlTemplate: "https://www.myntra.com/{slug_query}",
        engine: "httpx",
      },
    ]);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.engine).toBe("httpx");
  });
});

describe("staticFallbackSites", () => {
  it("returns region-specific tier-1 retailers", () => {
    expect(staticFallbackSites("IN").length).toBeGreaterThanOrEqual(5);
    expect(staticFallbackSites("US").length).toBeGreaterThanOrEqual(3);
  });

  it("uses snitch.com HTML search with playwright for IN", () => {
    const snitch = staticFallbackSites("IN").find((s) => s.name === "Snitch");
    expect(snitch?.domain).toBe("snitch.com");
    expect(snitch?.searchUrlTemplate).toBe(
      "https://www.snitch.com/search?q={query}"
    );
    expect(snitch?.engine).toBe("playwright");
    expect(snitch?.searchUrlTemplate).not.toContain("search.json");
  });

  it("keeps Banana Club on Shopify JSON search", () => {
    const banana = staticFallbackSites("IN").find((s) => s.name === "Banana Club");
    expect(banana?.searchUrlTemplate).toContain("search.json");
    expect(banana?.engine).toBe("httpx");
  });
});

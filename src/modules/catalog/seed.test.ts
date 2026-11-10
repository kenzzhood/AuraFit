import { describe, expect, it } from "vitest";
import { seedLooks } from "@/modules/runtime/world";

describe("demo catalogue", () => {
  it("seeds more than sixty styles and an image for each", () => {
    const looks = seedLooks();
    expect(looks.length).toBeGreaterThanOrEqual(60);
    expect(looks.every((look) => look.image?.startsWith("/catalog/"))).toBe(true);
    expect(new Set(looks.map((look) => look.id)).size).toBe(looks.length);
  });
});

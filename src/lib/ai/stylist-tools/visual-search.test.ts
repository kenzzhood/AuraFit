import { describe, expect, it } from "vitest";
import { buildVisualSearchQuery } from "./visual-query";

describe("buildVisualSearchQuery", () => {
  it("builds a query from describe text without calling Azure", () => {
    expect(
      buildVisualSearchQuery({
        description: "olive green cargo pants",
        category: "BOTTOM",
        extraQuery: "relaxed fit",
      })
    ).toBe("relaxed fit olive green cargo pants bottom");
  });

  it("includes caption and tags", () => {
    const q = buildVisualSearchQuery({
      description: "white cotton tee",
      category: "top",
      caption: "a white t-shirt",
      tags: ["cotton", "casual", "summer", "basic", "ignored"],
    });
    expect(q).toContain("white cotton tee");
    expect(q).toContain("top");
    expect(q).toContain("cotton");
    expect(q).not.toContain("ignored");
  });
});

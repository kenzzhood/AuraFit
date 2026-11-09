import { describe, expect, it } from "vitest";
import { readSearchConfig, searchCatalogue } from "./index";

describe("catalogue search", () => {
  it("matches store text and does not call a paid API", () => {
    const hits = searchCatalogue(
      [
        { id: "1", name: "Kanjivaram saree", fabric: "Silk", color: "maroon", location: "Rack W3" },
        { id: "2", name: "Linen shirt", fabric: "Linen", color: "sand", location: "Rack M1" },
      ],
      "kanjivaram silk"
    );
    expect(hits.map((hit) => hit.id)).toEqual(["1"]);
    expect(searchCatalogue(hits, "a")).toEqual([]);
    expect(readSearchConfig().paidApis).toBe(false);
  });
});

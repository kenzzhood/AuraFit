import { describe, expect, it } from "vitest";
import { triedNotBought } from "./index";

describe("tried but not bought", () => {
  it("counts an opened look as tried and labels a barcode sale", () => {
    const rows = triedNotBought([
      { type: "look_shown", styleId: "blue-kurta", sessionId: "a", at: 1 },
      { type: "look_opened", styleId: "blue-kurta", sessionId: "a", at: 2 },
      { type: "look_opened", styleId: "blue-kurta", sessionId: "b", at: 3 },
      { type: "sold", styleId: "blue-kurta", sessionId: "b", at: 4, source: "barcode" },
      { type: "look_shown", styleId: "saree", sessionId: "c", at: 5 },
    ]);
    const kurta = rows.find((row) => row.styleId === "blue-kurta");
    expect(kurta?.opened).toBe(2);
    expect(kurta?.sold).toBe(1);
    expect(kurta?.attribution).toBe("barcode-matched");
    expect(rows[0].styleId).toBe("blue-kurta");
  });
});

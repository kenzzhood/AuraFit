import { describe, expect, it } from "vitest";
import {
  applyNightlySales,
  classifyAvailability,
  publicStockLabel,
  readInventoryConfig,
} from "./index";

describe("inventory confidence", () => {
  it("labels a seen in-file item available and never returns a count", () => {
    const decision = classifyAvailability({
      qty: 4,
      fileAgeDays: 0,
      missingTapDaysAgo: null,
      seenDaysAgo: 1,
    });
    expect(decision.label).toBe("available");
    expect(publicStockLabel(decision)).toBe("Available");
    expect(JSON.stringify(publicStockLabel(decision))).not.toMatch(/\d/);
    expect(readInventoryConfig({}).showQuantity).toBe(false);
  });

  it("downgrades the last piece, a stale file, and a missing tap", () => {
    expect(
      classifyAvailability({
        qty: 1,
        fileAgeDays: 0,
        missingTapDaysAgo: null,
        seenDaysAgo: 1,
      }).label
    ).toBe("likely");
    expect(
      classifyAvailability({
        qty: 8,
        fileAgeDays: 5,
        missingTapDaysAgo: null,
        seenDaysAgo: 1,
      }).reason
    ).toBe("file_stale");
    expect(
      classifyAvailability({
        qty: 8,
        fileAgeDays: 0,
        missingTapDaysAgo: 1,
        seenDaysAgo: 1,
      }).label
    ).toBe("ask_staff");
  });

  it("subtracts a nightly sales file", () => {
    const next = applyNightlySales(new Map([["8901", 3]]), [{ barcode: "8901", sold: 2 }]);
    expect(next.get("8901")).toBe(1);
  });
});

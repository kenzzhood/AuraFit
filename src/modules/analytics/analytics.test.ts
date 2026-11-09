import { describe, expect, it } from "vitest";
import { ingestHeatmap, readAnalyticsConfig } from "./index";

describe("heatmap gate", () => {
  it("stays off and rejects a personal field", () => {
    expect(readAnalyticsConfig({}).enabled).toBe(false);
    expect(ingestHeatmap(false, false, { zoneId: "a", hour: "10", count: 3 }).ok).toBe(
      false
    );
    expect(
      ingestHeatmap(true, true, { zoneId: "a", hour: "10", count: 3, faceId: "x" }).ok
    ).toBe(false);
    expect(ingestHeatmap(true, true, { zoneId: "rail", hour: "10", count: 4 })).toEqual({
      ok: true,
      stored: { zoneId: "rail", hour: "10", count: 4 },
    });
  });
});

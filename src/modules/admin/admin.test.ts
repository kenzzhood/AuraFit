import { describe, expect, it } from "vitest";
import { readAdminConfig, setHeatmap, type StoreTenant } from "./index";

describe("admin feature flags", () => {
  it("refuses a heatmap until legal sign-off and defaults off", () => {
    const store: StoreTenant = {
      id: "anna",
      name: "Anna Nagar",
      brandId: "kasavu",
      heatmap: false,
      legalSignOff: false,
    };
    expect(setHeatmap(store, true, false)).toMatchObject({ ok: false, heatmap: false });
    expect(store.heatmap).toBe(false);
    expect(setHeatmap(store, true, true).heatmap).toBe(true);
    expect(readAdminConfig({}).heatmapDefault).toBe(false);
    expect(readAdminConfig({}).customCode).toBe(false);
  });
});

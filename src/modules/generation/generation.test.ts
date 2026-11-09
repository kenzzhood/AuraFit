import { describe, expect, it } from "vitest";
import {
  CORE_MODEL_IDS,
  planNightRender,
  renderPriority,
  routeGeneration,
} from "./index";

describe("generation routing", () => {
  it("sends a consenting adult to GPT Image 2 and falls back when quota is gone", () => {
    expect(
      routeGeneration({
        audience: "women",
        category: "saree",
        hasShopperPhoto: true,
        quotaRemaining: 2,
      })
    ).toMatchObject({ kind: "personal", backend: "gpt-image-2" });
    const fallback = routeGeneration({
      audience: "men",
      category: "shirt",
      hasShopperPhoto: true,
      quotaRemaining: 0,
    });
    expect(fallback).toMatchObject({ kind: "personal", backend: "flux-klein" });
  });

  it("never renders a real child photo and keeps swimwear on a model", () => {
    expect(
      routeGeneration({
        audience: "child",
        category: "frock",
        hasShopperPhoto: true,
        quotaRemaining: 4,
      })
    ).toEqual({ kind: "blocked", reason: "no_child_photo" });
    expect(
      routeGeneration({
        audience: "child",
        category: "frock",
        hasShopperPhoto: false,
        quotaRemaining: 4,
      })
    ).toMatchObject({ backend: "flux-klein", kind: "model" });
    expect(
      routeGeneration({
        audience: "women",
        category: "swimwear",
        hasShopperPhoto: true,
        quotaRemaining: 4,
      }).kind
    ).toBe("model");
  });

  it("renders the six core adult models before the rest, and pauses while the store is open", () => {
    const pairs = [
      ...CORE_MODEL_IDS.map((modelId) => ({
        lookId: "saree",
        modelId,
        audience: "women" as const,
        rendered: false,
      })),
      {
        lookId: "saree",
        modelId: "adult-women-slim-t1",
        audience: "women" as const,
        rendered: false,
      },
      {
        lookId: "frock",
        modelId: "child-girl-young",
        audience: "child" as const,
        rendered: false,
      },
    ];
    const night = planNightRender({ storeOpen: false, liveDemand: false, pairs });
    expect(night.paused).toBe(false);
    expect(night.jobs[0].phase).toBe("core");
    expect(night.jobs.find((job) => job.modelId === "adult-women-slim-t1")?.phase).toBe(
      "ondemand"
    );
    expect(night.jobs.at(-1)?.backend).toBe("flux-klein");
    expect(planNightRender({ storeOpen: true, liveDemand: false, pairs }).paused).toBe(
      true
    );
    expect(renderPriority("live")).toBeLessThan(renderPriority("night"));
  });
});

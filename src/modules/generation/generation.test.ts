import { describe, expect, it } from "vitest";
import { FACE_PRESERVATION_CHECK } from "./face-preservation.fixture";
import {
  CORE_MODEL_IDS,
  IMAGE_MODEL_DEFAULT,
  IMAGE_MODEL_RETIRES_ON,
  IMAGE_MODEL_UPGRADE,
  IMAGE_MODEL_VERSION,
  IMAGE_QUALITIES,
  IMAGE_SIZE,
  imageRetirementWarning,
  planNightRender,
  readGenerationConfig,
  renderPriority,
  routeGeneration,
} from "./index";

describe("generation routing", () => {
  it("sends a consenting adult to the Azure image model and falls back when quota is gone", () => {
    expect(readGenerationConfig({}).model).toBe(IMAGE_MODEL_DEFAULT);
    expect(readGenerationConfig({}).model).toBe("gpt-image-2.5-sunburst");
    expect(readGenerationConfig({}).version).toBe(IMAGE_MODEL_VERSION);
    expect(readGenerationConfig({}).version).toBe("2026-09-09");
    expect(readGenerationConfig({}).retiresOn).toBe(IMAGE_MODEL_RETIRES_ON);
    expect(readGenerationConfig({}).provider).toBe("azure-openai");
    expect(readGenerationConfig({ AURAFIT_IMAGE_MODEL: "gpt-image-2.6-sunburst" }).model).toBe(
      "gpt-image-2.6-sunburst"
    );
    expect(IMAGE_MODEL_UPGRADE).toBe("gpt-image-2.6-sunburst");
    expect(IMAGE_SIZE).toBe("1536x1024");
    expect(IMAGE_QUALITIES).toEqual(["low", "medium", "high"]);
    expect(
      routeGeneration({
        audience: "women",
        category: "saree",
        hasShopperPhoto: true,
        quotaRemaining: 2,
      })
    ).toMatchObject({
      kind: "personal",
      backend: "azure-gpt-image",
      model: "gpt-image-2.5-sunburst",
      faceEdit: true,
    });
    const fallback = routeGeneration({
      audience: "men",
      category: "shirt",
      hasShopperPhoto: true,
      quotaRemaining: 0,
    });
    expect(fallback).toMatchObject({ kind: "personal", backend: "flux-klein", faceEdit: false });
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
    ).toMatchObject({ backend: "flux-klein", kind: "model", faceEdit: false });
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
    expect(night.jobs[0].modelVersion).toBe("gpt-image-2.5-sunburst");
    expect(night.jobs.find((job) => job.modelId === "adult-women-slim-t1")?.phase).toBe(
      "ondemand"
    );
    expect(night.jobs.at(-1)?.backend).toBe("flux-klein");
    expect(night.jobs.at(-1)?.modelVersion).toBe("flux-klein-4b");
    expect(planNightRender({ storeOpen: true, liveDemand: false, pairs }).paused).toBe(
      true
    );
    expect(renderPriority("live")).toBeLessThan(renderPriority("night"));
  });

  it("warns inside 90 days of retirement and records the face check as still open", () => {
    expect(imageRetirementWarning(new Date("2026-11-09T00:00:00.000Z"))).toBeNull();
    expect(imageRetirementWarning(new Date("2027-07-01T00:00:00.000Z"))).toMatch(
      /2027-09-09/
    );
    expect(FACE_PRESERVATION_CHECK.model).toBe("gpt-image-2.5-sunburst");
    expect(FACE_PRESERVATION_CHECK.identityCheckedOnSunburst).toBe(false);
    expect(FACE_PRESERVATION_CHECK.audience).toBe("adult-with-consent");
  });
});

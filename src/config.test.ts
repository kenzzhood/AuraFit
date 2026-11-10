import { describe, expect, it } from "vitest";
import { readConfig } from "./config";

describe("config", () => {
  it("runs with no environment file", () => {
    expect(readConfig({})).toMatchObject({
      AURAFIT_IMAGE_PROVIDER: "mock",
      AURAFIT_IMAGE_MODEL: "gpt-image-2.5-sunburst",
      AURAFIT_DB: "pglite",
      AURAFIT_GESTURE: "sim",
    });
  });
});

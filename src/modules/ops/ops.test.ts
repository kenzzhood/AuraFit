import { describe, expect, it } from "vitest";
import { deviceHealth } from "./index";

describe("device health", () => {
  it("is green only when the camera, cache and heartbeat are fine", () => {
    expect(
      deviceHealth({ cameraFps: 24, heartbeatAgeMs: 30_000, tempC: 60, cacheFresh: true })
    ).toBe("green");
    expect(
      deviceHealth({ cameraFps: 0, heartbeatAgeMs: 10_000, tempC: 40, cacheFresh: true })
    ).toBe("red");
    expect(
      deviceHealth({ cameraFps: 24, heartbeatAgeMs: 100_000, tempC: 40, cacheFresh: true })
    ).toBe("amber");
  });
});

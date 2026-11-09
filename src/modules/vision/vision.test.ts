import { describe, expect, it } from "vitest";
import {
  assessCapture,
  bodyBucket,
  claimActiveUser,
  createPhotoStore,
  readVisionConfig,
  stockModelId,
  toneCode,
  type VisionFrame,
} from "./index";

const config = readVisionConfig({});

function person(
  partial: Partial<VisionFrame["people"][number]>
): VisionFrame["people"][number] {
  return {
    id: "a",
    centerX: 0.5,
    height: 0.7,
    distanceM: 1.2,
    handRaisedMs: 1000,
    ...partial,
  };
}

describe("active user", () => {
  it("claims the centred shopper who holds a hand on the footprints", () => {
    const decision = claimActiveUser(
      { ts: 0, people: [person({ id: "priya" })] },
      config
    );
    expect(decision).toEqual({ activeUserId: "priya", reason: "raised_hand" });
  });

  it("ignores a crowd that is off the footprints or too small", () => {
    const decision = claimActiveUser(
      {
        ts: 0,
        people: [
          person({ id: "edge", centerX: 0.1 }),
          person({ id: "child-playing", height: 0.2 }),
          person({ id: "far", distanceM: 3 }),
          person({ id: "brief", handRaisedMs: 200 }),
        ],
      },
      config
    );
    expect(decision.activeUserId).toBeNull();
  });

  it("breaks a tie toward the centre, then the larger person", () => {
    const decision = claimActiveUser(
      {
        ts: 0,
        people: [
          person({ id: "left", centerX: 0.4, height: 0.9 }),
          person({ id: "centre", centerX: 0.5, height: 0.6 }),
        ],
      },
      config
    );
    expect(decision.activeUserId).toBe("centre");
  });
});

describe("capture and matching", () => {
  it("rejects a blurry or cropped frame", () => {
    expect(
      assessCapture({
        laplacian: 10,
        exposure: 0.5,
        headVisible: true,
        feetVisible: true,
        personCount: 1,
      }).ok
    ).toBe(false);
    expect(
      assessCapture({
        laplacian: 120,
        exposure: 0.5,
        headVisible: false,
        feetVisible: true,
        personCount: 1,
      }).hint
    ).toMatch(/head and feet/i);
  });

  it("keeps an unsure tone on the middle code and takes gender only from the caller", () => {
    expect(toneCode(null)).toEqual({ code: "t2", confidence: "low" });
    expect(bodyBucket(1.4)).toBe("broad");
    expect(stockModelId("women", "broad", "t2")).toBe("adult-women-broad-t2");
  });

  it("holds a photo only in memory and deletes it", () => {
    const store = createPhotoStore();
    store.remember("s1", new Uint8Array([1, 2, 3]), 0);
    expect(store.has("s1")).toBe(true);
    expect(store.forget("s1")).toBe(true);
    expect(store.has("s1")).toBe(false);
    store.remember("old", new Uint8Array([1]), 0);
    expect(store.purge(60 * 60 * 1000 + 1)).toBe(1);
  });
});

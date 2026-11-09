import { beforeEach, describe, expect, it } from "vitest";
import { act, resetSessions } from "./act";
import { createDemoWorld } from "./world";
import type { KioskAction } from "./act";

function run() {
  const world = createDemoWorld();
  let sessionId: string | null = null;
  const step = (action: KioskAction, now: number) => {
    const result = act(world, sessionId, action, now);
    sessionId = result.sessionId;
    return result;
  };
  return { world, step };
}

describe("kiosk session", () => {
  beforeEach(() => resetSessions());

  it("takes one adult photo, shows stock looks, and deletes the photo on reset", () => {
    const { step } = run();
    expect(step({ type: "boot", deviceId: "kiosk-1", mode: "kiosk" }, 0).view.screen).toBe("idle");
    expect(step({ type: "presence", present: true }, 1_000).view.screen).toBe("detected");
    expect(step({ type: "raiseHand" }, 2_000).view.screen).toBe("language");
    step({ type: "choose", tileId: "en" }, 3_000);
    step({ type: "choose", tileId: "women" }, 4_000);
    step({ type: "choose", tileId: "wedding" }, 5_000);
    step({ type: "choose", tileId: "5000_plus" }, 6_000);
    expect(step({ type: "choose", tileId: "skip" }, 7_000).view.screen).toBe("consent");
    expect(step({ type: "choose", tileId: "consent-yes" }, 8_000).view.screen).toBe("pose");
    const looks = step(
      {
        type: "capture",
        quality: {
          laplacian: 140,
          exposure: 0.5,
          headVisible: true,
          feetVisible: true,
          personCount: 1,
        },
        lightness: 40,
      },
      9_000
    ).view;
    expect(looks.screen).toBe("looks");
    expect(looks.photoStored).toBe(true);
    expect(looks.tiles.length).toBeGreaterThan(0);
    expect(looks.tiles.length).toBeLessThanOrEqual(6);
    expect(JSON.stringify(looks)).not.toMatch(/fair|dark|skin|qty|t1|t2|t3/i);
    const detail = step({ type: "choose", tileId: looks.tiles[0].id }, 10_000).view;
    expect(detail.screen).toBe("detail");
    expect(detail.detail?.fabric).toBeTruthy();
    expect(detail.detail?.availabilityText).not.toMatch(/\d/);
    const preview = step({ type: "choose", tileId: "tryon" }, 11_000).view;
    expect(preview.screen).toBe("onYou");
    expect(preview.renderNote).toMatch(/preview|model/i);
    step({ type: "presence", present: false }, 12_000);
    const thanks = step({ type: "tick" }, 27_000).view;
    expect(thanks.screen).toBe("thanks");
    expect(thanks.photoStored).toBe(false);
    expect(step({ type: "tick" }, 28_000).view.screen).toBe("idle");
  });

  it("never stores a photo for a child", () => {
    const { step } = run();
    step({ type: "boot", deviceId: "kiosk-1", mode: "kiosk" }, 0);
    step({ type: "presence", present: true }, 1);
    step({ type: "raiseHand" }, 2);
    step({ type: "choose", tileId: "ta" }, 3);
    step({ type: "choose", tileId: "child" }, 4);
    step({ type: "choose", tileId: "daily" }, 5);
    step({ type: "choose", tileId: "1000_2500" }, 6);
    const models = step({ type: "choose", tileId: "skip" }, 7).view;
    expect(models.screen).toBe("childModel");
    const looks = step({ type: "choose", tileId: "child-girl-young" }, 8).view;
    expect(looks.screen).toBe("looks");
    expect(looks.photoStored).toBe(false);
    const blocked = step(
      {
        type: "capture",
        quality: {
          laplacian: 200,
          exposure: 0.5,
          headVisible: true,
          feetVisible: true,
          personCount: 1,
        },
      },
      9
    ).view;
    expect(blocked.photoStored).toBe(false);
    expect(blocked.notice).toMatch(/no photo/i);
  });

  it("caps personal previews and escalates an unanswered staff alert", () => {
    const { world, step } = run();
    step({ type: "boot", deviceId: "kiosk-1", mode: "kiosk" }, 0);
    step({ type: "presence", present: true }, 1);
    step({ type: "raiseHand" }, 2);
    step({ type: "choose", tileId: "en" }, 3);
    step({ type: "choose", tileId: "women" }, 4);
    step({ type: "choose", tileId: "office" }, 5);
    step({ type: "choose", tileId: "1000_2500" }, 6);
    step({ type: "choose", tileId: "skip" }, 7);
    step({ type: "choose", tileId: "consent-yes" }, 8);
    const looks = step(
      {
        type: "capture",
        quality: {
          laplacian: 140,
          exposure: 0.5,
          headVisible: true,
          feetVisible: true,
          personCount: 1,
        },
        lightness: 55,
      },
      9
    ).view;
    expect(looks.tiles.some((tile) => tile.id === "look:blue-kurta")).toBe(true);
    step({ type: "choose", tileId: "look:blue-kurta" }, 10);
    step({ type: "choose", tileId: "tryon" }, 11);
    step({ type: "back" }, 12);
    step({ type: "choose", tileId: "tryon" }, 13);
    step({ type: "back" }, 14);
    const third = step({ type: "choose", tileId: "tryon" }, 15).view;
    expect(third.screen).toBe("onYou");
    step({ type: "back" }, 16);
    const capped = step({ type: "choose", tileId: "tryon" }, 17).view;
    expect(capped.screen).toBe("detail");
    expect(capped.notice).toMatch(/three/i);
    step({ type: "choose", tileId: "staff" }, 18);
    expect(world.alerts).toHaveLength(1);
    step({ type: "tick" }, 18 + 120_000);
    expect(world.alerts[0].escalation).toBe("manager");
  });
});

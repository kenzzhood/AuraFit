import { describe, expect, it } from "vitest";
import {
  chooseHandIndex,
  EMPTY_GESTURE,
  GRAB_CONFIRM_MS,
  isOpenPalm,
  LOST_HAND_MS,
  OneEuroFilter,
  PINCH_GRAB,
  PINCH_RELEASE,
  stepGesture,
  stepPalm,
  type Point,
} from "@/stall/gestures";

function pose(open: boolean): Point[] {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.55 }));
  lm[0] = { x: 0.5, y: 0.86 };
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  tips.forEach((tip, index) => {
    const x = 0.32 + index * 0.12;
    lm[tip] = { x, y: open ? 0.18 : 0.78 };
    lm[pips[index]] = { x, y: open ? 0.48 : 0.8 };
  });
  lm[4] = open ? { x: 0.12, y: 0.42 } : { x: 0.34, y: 0.74 };
  return lm;
}

describe("hand gestures", () => {
  it("smooths jitter with the One Euro filter", () => {
    const filter = new OneEuroFilter(1, 0.01);
    let t = 0;
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      t += 1 / 30;
      samples.push(filter.filter(t, 0.5 + (i % 2 === 0 ? 0.03 : -0.03)));
    }
    const mean = samples.reduce((sum, n) => sum + n, 0) / samples.length;
    const variance =
      samples.reduce((sum, n) => sum + (n - mean) ** 2, 0) / samples.length;
    expect(variance).toBeLessThan(0.0004);
  });

  it("detects an open palm and ignores a closed hand", () => {
    expect(isOpenPalm(pose(true))).toBe(true);
    expect(isOpenPalm(pose(false))).toBe(false);
  });

  it("waits through the grab confirm delay, then holds with hysteresis", () => {
    const pending = stepGesture(EMPTY_GESTURE, {
      now: 1000,
      handPresent: true,
      pinchDistance: PINCH_GRAB - 0.01,
      x: 0.4,
      y: 0.4,
      draggableId: "dress-1",
      overCart: false,
      jump: false,
    });
    expect(pending.action.type).toBe("none");
    expect(pending.state.phase).toBe("pending");

    const tooSoon = stepGesture(pending.state, {
      now: 1000 + GRAB_CONFIRM_MS - 20,
      handPresent: true,
      pinchDistance: PINCH_GRAB - 0.01,
      x: 0.42,
      y: 0.42,
      draggableId: "dress-1",
      overCart: false,
      jump: false,
    });
    expect(tooSoon.state.phase).toBe("pending");

    const grabbed = stepGesture(tooSoon.state, {
      now: 1000 + GRAB_CONFIRM_MS + 5,
      handPresent: true,
      pinchDistance: PINCH_GRAB - 0.005,
      x: 0.5,
      y: 0.5,
      draggableId: "dress-1",
      overCart: false,
      jump: false,
    });
    expect(grabbed.action).toEqual({ type: "grab", itemId: "dress-1" });

    const stillHeld = stepGesture(grabbed.state, {
      now: 1300,
      handPresent: true,
      pinchDistance: (PINCH_GRAB + PINCH_RELEASE) / 2,
      x: 0.2,
      y: 0.5,
      draggableId: null,
      overCart: true,
      jump: false,
    });
    expect(stillHeld.state.phase).toBe("held");
    expect(stillHeld.action.type).toBe("none");
  });

  it("drops on the cart and cancels when released outside it", () => {
    const held = {
      ...EMPTY_GESTURE,
      phase: "held" as const,
      itemId: "dress-1",
      since: 1,
    };
    const dropped = stepGesture(held, {
      now: 50,
      handPresent: true,
      pinchDistance: PINCH_RELEASE + 0.02,
      x: 0.1,
      y: 0.5,
      draggableId: null,
      overCart: true,
      jump: false,
    });
    expect(dropped.action).toEqual({ type: "drop", itemId: "dress-1" });

    const cancelled = stepGesture(held, {
      now: 50,
      handPresent: true,
      pinchDistance: PINCH_RELEASE + 0.02,
      x: 0.8,
      y: 0.5,
      draggableId: null,
      overCart: false,
      jump: false,
    });
    expect(cancelled.action).toEqual({ type: "cancel", itemId: "dress-1" });
  });

  it("cancels a drag when the hand disappears, and ignores a brief loss", () => {
    const held = {
      ...EMPTY_GESTURE,
      phase: "held" as const,
      itemId: "coat-1",
      since: 1,
    };
    const brief = stepGesture(held, {
      now: 100,
      handPresent: false,
      pinchDistance: 1,
      x: 0,
      y: 0,
      draggableId: null,
      overCart: true,
      jump: false,
    });
    expect(brief.action.type).toBe("none");
    expect(brief.state.phase).toBe("held");

    const gone = stepGesture(brief.state, {
      now: 100 + LOST_HAND_MS + 1,
      handPresent: false,
      pinchDistance: 1,
      x: 0,
      y: 0,
      draggableId: null,
      overCart: true,
      jump: false,
    });
    expect(gone.action).toEqual({ type: "cancel", itemId: "coat-1" });
  });

  it("does not drop on a tracking jump", () => {
    const held = {
      ...EMPTY_GESTURE,
      phase: "held" as const,
      itemId: "hat-1",
    };
    const jumped = stepGesture(held, {
      now: 10,
      handPresent: true,
      pinchDistance: PINCH_RELEASE + 0.05,
      x: 0.9,
      y: 0.9,
      draggableId: null,
      overCart: false,
      jump: true,
    });
    expect(jumped.state.phase).toBe("held");
    expect(jumped.action.type).toBe("none");
  });

  it("clicks a short pinch that never becomes a grab", () => {
    const pending = stepGesture(EMPTY_GESTURE, {
      now: 0,
      handPresent: true,
      pinchDistance: 0.03,
      x: 0.5,
      y: 0.5,
      draggableId: null,
      overCart: false,
      jump: false,
    });
    const released = stepGesture(pending.state, {
      now: 80,
      handPresent: true,
      pinchDistance: 0.12,
      x: 0.51,
      y: 0.5,
      draggableId: null,
      overCart: false,
      jump: false,
    });
    expect(released.action.type).toBe("click");
  });

  it("keeps the active hand when a second hand appears", () => {
    const previous = { x: 0.2, y: 0.4 };
    const index = chooseHandIndex(previous, [
      { x: 0.8, y: 0.2, score: 0.99 },
      { x: 0.22, y: 0.41, score: 0.4 },
    ]);
    expect(index).toBe(1);
  });

  it("fires the palm only after it stays open and still", () => {
    const first = stepPalm({ since: null }, true, true, 0, 700);
    expect(first.fire).toBe(false);
    const done = stepPalm(first.state, true, true, 700, 700);
    expect(done.fire).toBe(true);
    const moved = stepPalm({ since: 0 }, true, false, 800, 700);
    expect(moved.progress).toBe(0);
  });
});

export type Point = { x: number; y: number };

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** One Euro filter. `t` is seconds. */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private minCutoff = 1.1,
    private beta = 0.04,
    private dCutoff = 1
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(t: number, x: number): number {
    if (this.tPrev == null || this.xPrev == null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }
    const dt = Math.max(1e-3, t - this.tPrev);
    const dx = (x - this.xPrev) / dt;
    const edx = this.smooth(dx, this.dxPrev, this.alpha(dt, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xHat = this.smooth(x, this.xPrev, this.alpha(dt, cutoff));
    this.xPrev = xHat;
    this.dxPrev = edx;
    this.tPrev = t;
    return xHat;
  }

  private alpha(dt: number, cutoff: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  private smooth(x: number, prev: number, a: number): number {
    return a * x + (1 - a) * prev;
  }
}

export function isOpenPalm(lm: Point[]): boolean {
  if (lm.length < 21) return false;
  const wrist = lm[0];
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let extended = 0;
  for (let i = 0; i < 4; i++) {
    const tipD = dist(lm[tips[i]], wrist);
    const pipD = dist(lm[pips[i]], wrist);
    if (tipD > pipD + 0.04 && tipD > 0.22) extended += 1;
  }
  return extended >= 4 && dist(lm[4], lm[8]) > 0.09;
}

export type GesturePhase = "open" | "pending" | "held";

export type GestureSnapshot = {
  phase: GesturePhase;
  since: number;
  originX: number;
  originY: number;
  itemId: string | null;
  lostSince: number | null;
};

export const EMPTY_GESTURE: GestureSnapshot = {
  phase: "open",
  since: 0,
  originX: 0,
  originY: 0,
  itemId: null,
  lostSince: null,
};

/** Pinch closer than this starts a grab or a click. */
export const PINCH_GRAB = 0.05;
/** Pinch must open past this before a held item releases. */
export const PINCH_RELEASE = 0.08;
export const GRAB_CONFIRM_MS = 130;
export const LOST_HAND_MS = 180;
export const CLICK_MAX_MOVE = 0.045;

export type GestureInput = {
  now: number;
  handPresent: boolean;
  pinchDistance: number;
  x: number;
  y: number;
  draggableId: string | null;
  overCart: boolean;
  /** Ignore release on a single-frame tracking spike. */
  jump: boolean;
};

export type GestureAction =
  | { type: "none" }
  | { type: "grab"; itemId: string }
  | { type: "click" }
  | { type: "drop"; itemId: string }
  | { type: "cancel"; itemId: string | null };

export function stepGesture(
  state: GestureSnapshot,
  input: GestureInput
): { state: GestureSnapshot; action: GestureAction } {
  if (!input.handPresent) {
    if (state.phase === "open") return { state, action: { type: "none" } };
    const lostSince = state.lostSince ?? input.now;
    if (input.now - lostSince >= LOST_HAND_MS) {
      return {
        state: { ...EMPTY_GESTURE },
        action: { type: "cancel", itemId: state.itemId },
      };
    }
    return { state: { ...state, lostSince }, action: { type: "none" } };
  }

  const present = { ...state, lostSince: null };
  const moved = Math.hypot(input.x - present.originX, input.y - present.originY);

  if (present.phase === "held" && input.jump) {
    return { state: present, action: { type: "none" } };
  }

  if (present.phase === "open") {
    if (input.pinchDistance < PINCH_GRAB) {
      return {
        state: {
          ...present,
          phase: "pending",
          since: input.now,
          originX: input.x,
          originY: input.y,
          itemId: input.draggableId,
        },
        action: { type: "none" },
      };
    }
    return { state: present, action: { type: "none" } };
  }

  if (present.phase === "pending") {
    if (input.pinchDistance > PINCH_RELEASE) {
      const click = moved <= CLICK_MAX_MOVE;
      return {
        state: { ...EMPTY_GESTURE },
        action: click ? { type: "click" } : { type: "none" },
      };
    }
    if (
      input.now - present.since >= GRAB_CONFIRM_MS &&
      input.draggableId &&
      input.pinchDistance < PINCH_GRAB
    ) {
      return {
        state: {
          ...present,
          phase: "held",
          since: input.now,
          itemId: input.draggableId,
        },
        action: { type: "grab", itemId: input.draggableId },
      };
    }
    return { state: present, action: { type: "none" } };
  }

  if (input.pinchDistance > PINCH_RELEASE) {
    if (input.overCart && present.itemId) {
      return {
        state: { ...EMPTY_GESTURE },
        action: { type: "drop", itemId: present.itemId },
      };
    }
    return {
      state: { ...EMPTY_GESTURE },
      action: { type: "cancel", itemId: present.itemId },
    };
  }
  return { state: present, action: { type: "none" } };
}

export function chooseHandIndex(
  previous: Point | null,
  hands: { x: number; y: number; score: number }[]
): number {
  if (hands.length === 0) return -1;
  if (!previous || hands.length === 1) {
    let best = 0;
    for (let i = 1; i < hands.length; i++) {
      if (hands[i].score > hands[best].score) best = i;
    }
    return best;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < hands.length; i++) {
    const d = dist(hands[i], previous);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function stepPalm(
  state: { since: number | null },
  palm: boolean,
  still: boolean,
  now: number,
  holdMs = 700
): { state: { since: number | null }; progress: number; fire: boolean } {
  if (!palm || !still) return { state: { since: null }, progress: 0, fire: false };
  const since = state.since ?? now;
  const progress = Math.min(1, (now - since) / holdMs);
  const fire = state.since != null && progress >= 1;
  return {
    state: { since: fire ? null : since },
    progress: fire ? 0 : progress,
    fire,
  };
}

export function decayVelocity(velocity: number, dt: number, friction = 2.4): number {
  return velocity * Math.exp(-friction * dt);
}

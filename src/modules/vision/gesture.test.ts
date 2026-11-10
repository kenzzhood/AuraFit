import { describe, expect, it } from "vitest";
import { gestureFromSim } from "./gesture";

describe("sim gestures", () => {
  it("treats a held pointer and the H key as a claim", () => {
    expect(gestureFromSim({ dwellMs: 700 })).toBe("dwell");
    expect(gestureFromSim({ key: "h", dwellMs: 0 })).toBe("raise");
    expect(gestureFromSim({ dwellMs: 100 })).toBe("none");
  });
});

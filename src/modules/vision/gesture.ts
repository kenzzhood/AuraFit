export type SimGesture = "none" | "raise" | "dwell";

/** Pointer and keyboard stand in for the camera when no device is attached. */
export function gestureFromSim(input: { key?: string; dwellMs: number }): SimGesture {
  if (input.key === "h" || input.key === "H") return "raise";
  if (input.dwellMs >= 700) return "dwell";
  return "none";
}

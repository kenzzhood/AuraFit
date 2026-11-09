/** Business rules for a live kiosk session. Photos are not part of this module. */

export const RULES = {
  maxPersonalRenders: 3,
  detectedLeaveMs: 5_000,
  stillThereMs: 4_000,
  resetAfterMs: 15_000,
  captureRetries: 2,
} as const;

export function personalPhotoAllowed(input: {
  forWhom: "women" | "men" | "child" | "gift" | null;
  consent: boolean | null;
}): boolean {
  if (input.forWhom === "child" || input.forWhom === "gift") return false;
  return input.consent === true;
}

export function readIntelligenceConfig() {
  return RULES;
}

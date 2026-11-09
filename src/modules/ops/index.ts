export type Health = "green" | "amber" | "red";

export function deviceHealth(input: {
  cameraFps: number;
  heartbeatAgeMs: number;
  tempC: number;
  cacheFresh: boolean;
}): Health {
  if (input.heartbeatAgeMs > 180_000 || input.cameraFps <= 0 || input.tempC >= 85) {
    return "red";
  }
  if (
    input.cameraFps < 20 ||
    input.heartbeatAgeMs > 90_000 ||
    input.tempC >= 75 ||
    !input.cacheFresh
  ) {
    return "amber";
  }
  return "green";
}

export function readOpsConfig() {
  return { heartbeatMs: 60_000, remoteFixHours: 4 };
}

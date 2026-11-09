const BANNED = ["face", "image", "photo", "age", "gender", "embedding", "name"];

export interface HeatmapCount {
  zoneId: string;
  hour: string;
  count: number;
}

export function ingestHeatmap(
  enabled: boolean,
  legalSignOff: boolean,
  payload: Record<string, unknown>
):
  | { ok: true; stored: HeatmapCount }
  | { ok: false; reason: string } {
  if (!enabled || !legalSignOff) return { ok: false, reason: "heatmap_off" };
  for (const key of Object.keys(payload)) {
    if (BANNED.some((word) => key.toLowerCase().includes(word))) {
      return { ok: false, reason: "personal_field" };
    }
  }
  if (typeof payload.zoneId !== "string" || typeof payload.count !== "number") {
    return { ok: false, reason: "invalid" };
  }
  if (typeof payload.hour !== "string") return { ok: false, reason: "invalid" };
  return {
    ok: true,
    stored: { zoneId: payload.zoneId, hour: payload.hour, count: payload.count },
  };
}

export function readAnalyticsConfig(env: Record<string, string | undefined> = process.env) {
  return { enabled: env.AURAFIT_HEATMAP_ENABLED === "true" };
}

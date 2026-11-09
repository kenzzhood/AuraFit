export interface StoreTenant {
  id: string;
  name: string;
  brandId: string;
  heatmap: boolean;
  legalSignOff: boolean;
}

export interface DeviceRecord {
  id: string;
  storeId: string;
  kind: "kiosk" | "atoms";
}

export function setHeatmap(
  store: StoreTenant,
  enabled: boolean,
  legalSignOff: boolean
): { ok: boolean; reason: string; heatmap: boolean } {
  if (enabled && !legalSignOff) {
    return { ok: false, reason: "legal_signoff_required", heatmap: false };
  }
  store.legalSignOff = legalSignOff;
  store.heatmap = enabled && legalSignOff;
  return { ok: true, reason: "updated", heatmap: store.heatmap };
}

export function readAdminConfig(env: Record<string, string | undefined> = process.env) {
  return {
    heatmapDefault: env.AURAFIT_HEATMAP_ENABLED === "true",
    customCode: false as const,
  };
}

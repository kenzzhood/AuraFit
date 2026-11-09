import type { AvailabilityLabel } from "@/modules/shared/types";

export interface StockSignal {
  qty: number | null;
  fileAgeDays: number | null;
  missingTapDaysAgo: number | null;
  seenDaysAgo: number | null;
}

export interface AvailabilityDecision {
  label: AvailabilityLabel;
  reason: string;
}

/**
 * Honest floor confidence. The quantity stays inside this function.
 * Callers show only the label.
 */
export function classifyAvailability(signal: StockSignal): AvailabilityDecision {
  if (signal.missingTapDaysAgo != null && signal.missingTapDaysAgo <= 3) {
    return { label: "ask_staff", reason: "size_missing" };
  }
  if (signal.fileAgeDays == null || signal.fileAgeDays > 3) {
    return { label: "ask_staff", reason: "file_stale" };
  }
  if (signal.qty == null || signal.qty <= 0) {
    return { label: "ask_staff", reason: "no_stock_signal" };
  }
  if (signal.seenDaysAgo == null) {
    return { label: "ask_staff", reason: "never_seen" };
  }
  if (signal.qty === 1) return { label: "likely", reason: "last_piece" };
  if (signal.seenDaysAgo > 14) return { label: "likely", reason: "unseen_14d" };
  return { label: "available", reason: "in_file_and_seen" };
}

export function publicStockLabel(decision: AvailabilityDecision): string {
  if (decision.label === "available") return "Available";
  if (decision.label === "likely") return "Likely available";
  return "Ask staff";
}

export interface SalesRow {
  barcode: string;
  sold: number;
}

export function applyNightlySales(
  stock: Map<string, number>,
  rows: SalesRow[]
): Map<string, number> {
  const next = new Map(stock);
  for (const row of rows) {
    if (!next.has(row.barcode) || row.sold < 0) continue;
    next.set(row.barcode, Math.max(0, (next.get(row.barcode) ?? 0) - row.sold));
  }
  return next;
}

export function readInventoryConfig(env: Record<string, string | undefined> = process.env) {
  return {
    unseenDays: Number(env.AURAFIT_UNSEEN_DAYS ?? 14),
    staleFileDays: Number(env.AURAFIT_STALE_FILE_DAYS ?? 3),
    showQuantity: false,
  };
}

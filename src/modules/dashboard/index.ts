export interface SessionEvent {
  type:
    | "look_shown"
    | "look_opened"
    | "tryon_requested"
    | "tryon_done"
    | "qr_scanned"
    | "staff_called"
    | "sold";
  styleId: string;
  sessionId: string;
  at: number;
  source?: "barcode" | "estimated";
}

export interface TriedRow {
  styleId: string;
  shown: number;
  opened: number;
  tryOn: number;
  saved: number;
  staffCalled: number;
  sold: number;
  attribution: "barcode-matched" | "estimated" | "none";
}

export function triedNotBought(events: SessionEvent[]): TriedRow[] {
  const rows = new Map<string, TriedRow>();
  const ensure = (styleId: string) => {
    const existing = rows.get(styleId);
    if (existing) return existing;
    const created: TriedRow = {
      styleId,
      shown: 0,
      opened: 0,
      tryOn: 0,
      saved: 0,
      staffCalled: 0,
      sold: 0,
      attribution: "none",
    };
    rows.set(styleId, created);
    return created;
  };
  for (const event of events) {
    const row = ensure(event.styleId);
    if (event.type === "look_shown") row.shown += 1;
    if (event.type === "look_opened") row.opened += 1;
    if (event.type === "tryon_done") row.tryOn += 1;
    if (event.type === "qr_scanned") row.saved += 1;
    if (event.type === "staff_called") row.staffCalled += 1;
    if (event.type === "sold") {
      row.sold += 1;
      row.attribution = event.source === "barcode" ? "barcode-matched" : "estimated";
    }
  }
  return [...rows.values()].sort((a, b) => b.opened + b.tryOn - (a.opened + a.tryOn));
}

export function readDashboardConfig() {
  return { mainReport: "tried-but-not-bought" as const };
}

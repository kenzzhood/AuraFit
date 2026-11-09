export const CSV_COLUMNS = [
  "style",
  "variant",
  "barcode",
  "price",
  "size",
  "colour",
  "stock",
  "location",
] as const;

export interface CatalogueRow {
  style: string;
  variant: string;
  barcode: string;
  price: number;
  size: string;
  colour: string;
  stock: number;
  location: string;
}

export function parseCatalogueCsv(text: string): {
  rows: CatalogueRow[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["empty"] };
  const header = lines[0].split(",").map((cell) => cell.trim());
  if (header.join(",") !== CSV_COLUMNS.join(",")) {
    return { rows: [], errors: ["header"] };
  }
  const rows: CatalogueRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = lines[index].split(",").map((cell) => cell.trim());
    if (cells.length !== CSV_COLUMNS.length) {
      errors.push(`row ${index} width`);
      continue;
    }
    const [style, variant, barcode, price, size, colour, stock, location] = cells;
    if (!/^\d{6,14}$/.test(barcode)) {
      errors.push(`row ${index} barcode`);
      continue;
    }
    const priceInr = Number(price);
    const qty = Number(stock);
    if (!Number.isInteger(priceInr) || priceInr < 0 || !Number.isInteger(qty) || qty < 0) {
      errors.push(`row ${index} number`);
      continue;
    }
    rows.push({
      style,
      variant,
      barcode,
      price: priceInr,
      size,
      colour,
      stock: qty,
      location,
    });
  }
  return { rows, errors };
}

export function photoQualityGate(score: number): "pass" | "reshoot" {
  return score >= 0.7 ? "pass" : "reshoot";
}

export function departmentCoverage(confirmed: number, departmentSize: number): {
  ratio: number;
  goLive: boolean;
} {
  if (departmentSize <= 0) return { ratio: 0, goLive: false };
  const ratio = confirmed / departmentSize;
  return { ratio, goLive: ratio >= 0.95 };
}

export function readCatalogConfig(env: Record<string, string | undefined> = process.env) {
  return {
    goLiveCoverage: Number(env.AURAFIT_GO_LIVE_COVERAGE ?? 0.95),
    qaFloor: Number(env.AURAFIT_PHOTO_QA ?? 0.7),
  };
}

import fs from "node:fs";
import path from "node:path";
import type {
  AccessoryType,
  CatalogFile,
  CatalogItem,
  Category,
  CharacterFile,
  CharacterGroup,
  CharacterItem,
  Gender,
  StoreName,
  StyleId,
} from "@/stall/types";
import { STYLE_OPTIONS } from "@/stall/types";

const STYLE_IDS = new Set<string>(STYLE_OPTIONS.map((entry) => entry.id));

export type CatalogSlot = {
  /** Path segments under public/catalog. */
  folder: string[];
  category: Category;
  accessoryType: AccessoryType | null;
};

export const CATALOG_SLOTS: CatalogSlot[] = [
  { folder: ["tops"], category: "tops", accessoryType: null },
  { folder: ["bottoms"], category: "bottoms", accessoryType: null },
  { folder: ["coats"], category: "coats", accessoryType: null },
  { folder: ["dresses"], category: "dresses", accessoryType: null },
  { folder: ["accessories", "watches"], category: "accessories", accessoryType: "watch" },
  { folder: ["accessories", "necklaces"], category: "accessories", accessoryType: "necklace" },
  { folder: ["accessories", "shoes"], category: "accessories", accessoryType: "shoe" },
  { folder: ["accessories", "hats"], category: "accessories", accessoryType: "hat" },
];

export const CHARACTER_SLOTS: { folder: string[]; group: CharacterGroup }[] = [
  { folder: ["anime"], group: "anime" },
  { folder: ["games"], group: "game" },
];

function signature(dir: string): string {
  if (!fs.existsSync(dir)) return `${dir}:missing`;
  let max = 0;
  let count = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      count += 1;
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > max) max = stat.mtimeMs;
      } catch {
        // A file removed mid-scan is skipped.
      }
    }
  }
  return `${dir}:${count}:${max}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function price(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function genderOf(value: unknown): Gender {
  const raw = text(value).toLowerCase();
  if (raw === "women" || raw === "woman") return "women";
  if (raw === "men" || raw === "man") return "men";
  if (raw === "unisex") return "unisex";
  return "unknown";
}

function storeOf(value: unknown): StoreName | null {
  const raw = text(value).toLowerCase();
  if (raw === "myntra" || raw === "amazon") return raw;
  return null;
}

function readJsonEntries(file: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as { items?: unknown; id?: unknown };
  if (Array.isArray(record.items)) return record.items;
  if (typeof record.id === "string") return [parsed];
  return [];
}

function jsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort()
    .map((name) => path.join(dir, name));
}

function safeFileName(value: string): string | null {
  const name = value.trim();
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  if (name.startsWith(".")) return null;
  return name;
}

function catalogItem(
  raw: unknown,
  slot: CatalogSlot,
  dir: string
): CatalogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = text(record.id);
  const title = text(record.title);
  const fileName = safeFileName(text(record.image));
  const url = text(record.url);
  const style = text(record.style);
  const store = storeOf(record.store);
  const priceInr = price(record.priceInr);
  if (!id || id === "example-id" || !title || !fileName || !url || !store || priceInr == null) {
    return null;
  }
  if (!STYLE_IDS.has(style)) return null;
  if (!url.startsWith("https://")) return null;
  const imageFile = path.join(dir, fileName);
  if (!fs.existsSync(imageFile)) return null;
  const mrp = price(record.mrpInr);
  const webImage = `/${["catalog", ...slot.folder, fileName].join("/")}`;
  return {
    id,
    title,
    brand: text(record.brand),
    priceInr,
    mrpInr: mrp,
    url,
    image: webImage,
    store,
    category: slot.category,
    gender: genderOf(record.gender),
    accessoryType: slot.accessoryType,
    color: text(record.color) || null,
    style: style as StyleId,
    ...(text(record.capturedAt) ? { capturedAt: text(record.capturedAt) } : {}),
  };
}

function characterItem(
  raw: unknown,
  group: CharacterGroup,
  dir: string,
  folder: string[]
): CharacterItem | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = text(record.id);
  const name = text(record.name);
  const series = text(record.series);
  const look = text(record.look);
  const hair = text(record.hair);
  const fileName = safeFileName(text(record.image));
  if (!id || id === "example-id" || !name || !series || !look || !hair || !fileName) return null;
  if (!fs.existsSync(path.join(dir, fileName))) return null;
  return {
    id,
    name,
    series,
    look,
    hair,
    image: `/${["characters", ...folder, fileName].join("/")}`,
    group,
  };
}

export function loadCatalogFrom(publicRoot: string): CatalogFile {
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const slot of CATALOG_SLOTS) {
    const dir = path.join(publicRoot, "catalog", ...slot.folder);
    for (const file of jsonFiles(dir)) {
      for (const raw of readJsonEntries(file)) {
        const item = catalogItem(raw, slot, dir);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return { items };
}

export function loadCharactersFrom(publicRoot: string): CharacterFile {
  const items: CharacterItem[] = [];
  const seen = new Set<string>();
  for (const slot of CHARACTER_SLOTS) {
    const dir = path.join(publicRoot, "characters", ...slot.folder);
    for (const file of jsonFiles(dir)) {
      for (const raw of readJsonEntries(file)) {
        const item = characterItem(raw, slot.group, dir, slot.folder);
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return { items };
}

const catalogCache: { sig: string; value: CatalogFile } = { sig: "", value: { items: [] } };
const characterCache: { sig: string; value: CharacterFile } = { sig: "", value: { items: [] } };

export function loadCatalog(publicRoot = path.join(process.cwd(), "public")): CatalogFile {
  const dir = path.join(publicRoot, "catalog");
  const sig = signature(dir);
  if (sig === catalogCache.sig) return catalogCache.value;
  const value = loadCatalogFrom(publicRoot);
  catalogCache.sig = sig;
  catalogCache.value = value;
  return value;
}

export function loadCharacters(publicRoot = path.join(process.cwd(), "public")): CharacterFile {
  const dir = path.join(publicRoot, "characters");
  const sig = signature(dir);
  if (sig === characterCache.sig) return characterCache.value;
  const value = loadCharactersFrom(publicRoot);
  characterCache.sig = sig;
  characterCache.value = value;
  return value;
}

export function safePublicImage(webPath: string, publicRoot = path.join(process.cwd(), "public")): string | null {
  if (!webPath.startsWith("/catalog/") && !webPath.startsWith("/characters/")) return null;
  if (webPath.includes("..") || webPath.includes("\\")) return null;
  const full = path.resolve(publicRoot, ...webPath.split("/").filter(Boolean));
  const catalogRoot = path.resolve(publicRoot, "catalog");
  const characterRoot = path.resolve(publicRoot, "characters");
  const inCatalog = full === catalogRoot || full.startsWith(catalogRoot + path.sep);
  const inCharacters = full === characterRoot || full.startsWith(characterRoot + path.sep);
  if (!inCatalog && !inCharacters) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

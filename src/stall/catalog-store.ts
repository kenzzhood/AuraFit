import fs from "node:fs";
import path from "node:path";
import type { CatalogFile, CharacterFile } from "@/stall/types";

const EMPTY_CATALOG: CatalogFile = { items: [] };
const EMPTY_CHARACTERS: CharacterFile = { items: [] };

function readJson<T>(file: string, fallback: T, mtime: { current: number }, cache: { current: T }): T {
  if (!fs.existsSync(file)) return fallback;
  const stat = fs.statSync(file);
  if (cache.current && stat.mtimeMs === mtime.current) return cache.current;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as T;
  mtime.current = stat.mtimeMs;
  cache.current = parsed;
  return parsed;
}

const catalogMtime = { current: 0 };
const catalogCache = { current: EMPTY_CATALOG };
const characterMtime = { current: 0 };
const characterCache = { current: EMPTY_CHARACTERS };

export function loadCatalog(): CatalogFile {
  return readJson(
    path.join(process.cwd(), "public/catalog/catalog.json"),
    EMPTY_CATALOG,
    catalogMtime,
    catalogCache
  );
}

export function loadCharacters(): CharacterFile {
  return readJson(
    path.join(process.cwd(), "public/characters/characters.json"),
    EMPTY_CHARACTERS,
    characterMtime,
    characterCache
  );
}

export function safePublicImage(webPath: string): string | null {
  if (
    !webPath.startsWith("/catalog/images/") &&
    !webPath.startsWith("/characters/images/")
  ) {
    return null;
  }
  if (webPath.includes("..")) return null;
  const full = path.resolve(process.cwd(), "public", webPath.slice(1));
  const root = path.resolve(process.cwd(), "public");
  if (!full.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

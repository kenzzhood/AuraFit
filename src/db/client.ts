import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { MIGRATION_SQL, styles } from "./schema";

export type StoreDatabase = PgliteDatabase;

let cached: StoreDatabase | null = null;

export async function openDatabase(dataDir = ".data/aurafit"): Promise<StoreDatabase> {
  if (cached && dataDir !== ":memory:") return cached;
  if (dataDir !== ":memory:") mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir === ":memory:" ? undefined : dataDir);
  await client.exec(MIGRATION_SQL);
  const db = drizzle(client);
  if (dataDir !== ":memory:") cached = db;
  return db;
}

export async function rememberStyle(db: StoreDatabase, id: string, availability: string) {
  await db
    .insert(styles)
    .values({ id, availability })
    .onConflictDoUpdate({ target: styles.id, set: { availability } });
}

export async function readStyles(db: StoreDatabase) {
  return db.select().from(styles);
}

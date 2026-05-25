import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("aurafit.db");
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS wardrobe_local (
        id TEXT PRIMARY KEY NOT NULL,
        local_uri TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS generation_cache (
        job_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        result TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  return db;
}

export type LocalWardrobeRow = {
  id: string;
  local_uri: string;
  category: string | null;
  tags: string | null;
  created_at: number;
};

export async function insertLocalWardrobe(row: {
  id: string;
  localUri: string;
  category?: string;
  tags?: string[];
}) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO wardrobe_local (id, local_uri, category, tags, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      row.id,
      row.localUri,
      row.category ?? null,
      row.tags ? JSON.stringify(row.tags) : null,
      Date.now(),
    ]
  );
}

export async function listLocalWardrobe(): Promise<LocalWardrobeRow[]> {
  const database = await getDb();
  return database.getAllAsync<LocalWardrobeRow>(
    `SELECT * FROM wardrobe_local ORDER BY created_at DESC`
  );
}

export async function cacheGenerationJob(
  jobId: string,
  payload: object,
  result?: object
) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO generation_cache (job_id, payload, result, updated_at)
     VALUES (?, ?, ?, ?)`,
    [jobId, JSON.stringify(payload), result ? JSON.stringify(result) : null, Date.now()]
  );
}

export async function getCachedGeneration(
  jobId: string
): Promise<{ payload: object; result?: object } | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{
    payload: string;
    result: string | null;
  }>(`SELECT payload, result FROM generation_cache WHERE job_id = ?`, [jobId]);
  if (!row) return null;
  return {
    payload: JSON.parse(row.payload) as object,
    result: row.result ? (JSON.parse(row.result) as object) : undefined,
  };
}

import { readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../prisma/migrations", import.meta.url).pathname;
const dryRun = process.argv.includes("--dry-run");

const entries = readdirSync(root, { withFileTypes: true });

let removed = 0;
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const dir = join(root, entry.name);
  const sql = join(dir, "migration.sql");
  if (existsSync(sql)) {
    const size = statSync(sql).size;
    console.log(`✓ ${entry.name}/migration.sql (${size} bytes)`);
    continue;
  }
  console.log(`✗ ${entry.name}/ — missing migration.sql`);
  if (!dryRun) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`    removed`);
    removed += 1;
  }
}

if (dryRun) {
  console.log("");
  console.log("Dry run. Pass no flags to delete the broken directories.");
} else {
  console.log("");
  console.log(`Done. Removed ${removed} broken migration director${removed === 1 ? "y" : "ies"}.`);
}

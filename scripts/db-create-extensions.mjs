// Idempotent CREATE EXTENSION statements. Run by scripts/db-init.sh
// before `prisma migrate deploy` so the migration's vector(1536) column type
// resolves on Azure Database for PostgreSQL Flexible Server.
//
// Includes a connection retry loop because brand-new Postgres firewall rules
// can take 30-60s to propagate, and post-deployment config flushes can
// briefly break TCP connectivity.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const extensions = ["vector", '"uuid-ossp"', "pgcrypto"];
const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5000;

function isTransient(err) {
  const msg = String(err?.message ?? err);
  return (
    err?.code === "P1001" || // can't reach database
    err?.code === "P1017" || // server closed the connection
    /Can't reach database server/i.test(msg) ||
    /ECONN/i.test(msg) ||
    /ETIMEDOUT/i.test(msg) ||
    /timeout/i.test(msg)
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      const wait = BASE_DELAY_MS * attempt;
      process.stdout.write(
        `\n      ↳ ${label}: transient error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${
          wait / 1000
        }s\n      `
      );
      await sleep(wait);
    }
  }
}

try {
  for (const ext of extensions) {
    process.stdout.write(`    • CREATE EXTENSION IF NOT EXISTS ${ext} ... `);
    await withRetry(`CREATE EXTENSION ${ext}`, () =>
      prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS ${ext}`)
    );
    process.stdout.write("ok\n");
  }
} finally {
  await prisma.$disconnect();
}

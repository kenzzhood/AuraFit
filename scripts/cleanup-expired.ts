#!/usr/bin/env tsx
/**
 * cleanup-expired.ts
 *
 * Maintenance script — deletes expired / stale rows to keep the DB lean.
 * Run manually or via a cron job / Inngest scheduled event.
 *
 * Usage:
 *   npx tsx scripts/cleanup-expired.ts
 *   npm run db:cleanup
 *
 * NOTE: After adding CANCELLED to JobStatus enum, run `npm run db:generate`
 * to regenerate Prisma client types before running this script.
 */
import { PrismaClient, JobStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const ago30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ago90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  console.log("[cleanup] Starting expired data cleanup...");
  console.log(`[cleanup] Reference time: ${now.toISOString()}`);

  // 1. Expired product cache entries
  const expiredProducts = await prisma.productCache.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  console.log(`[cleanup] Deleted ${expiredProducts.count} expired ProductCache rows`);

  // 2. Old generated images (blobs should be deleted from storage separately)
  const oldImages = await prisma.generatedImage.deleteMany({
    where: { createdAt: { lt: ago90Days } },
  });
  console.log(`[cleanup] Deleted ${oldImages.count} GeneratedImage records older than 90 days`);

  // 3. Old completed/failed generation jobs (keep payload-free summary only)
  // Note: include JobStatus.CANCELLED once `npm run db:generate` has been run
  // after the schema migration adds the CANCELLED enum value.
  const terminalStatuses = [JobStatus.DONE, JobStatus.FAILED];
  const oldJobs = await prisma.generationJob.deleteMany({
    where: {
      status: { in: terminalStatuses },
      createdAt: { lt: ago30Days },
    },
  });
  console.log(`[cleanup] Deleted ${oldJobs.count} old GenerationJob records (>30 days, terminal state)`);

  // 4. Old product search sessions
  const oldSessions = await prisma.productSearchSession.deleteMany({
    where: { createdAt: { lt: ago90Days } },
  });
  console.log(`[cleanup] Deleted ${oldSessions.count} old ProductSearchSession records`);

  // 5. Old crawl jobs
  const oldCrawlJobs = await prisma.crawlJob.deleteMany({
    where: {
      status: { in: ["DONE", "FAILED"] },
      createdAt: { lt: ago30Days },
    },
  });
  console.log(`[cleanup] Deleted ${oldCrawlJobs.count} old CrawlJob records`);

  // 6. Old analytics events
  const oldAnalytics = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: ago90Days } },
  });
  console.log(`[cleanup] Deleted ${oldAnalytics.count} AnalyticsEvent records older than 90 days`);

  console.log("[cleanup] Done.");
}

main()
  .catch((e) => {
    console.error("[cleanup] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

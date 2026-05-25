import { CrawlJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import type { ProductQuery } from "./providers/types";
import type { RankingContext } from "./ranking";

export const PRODUCT_CRAWL_EVENT = "aurafit/product.crawl.requested" as const;

export type ProductCrawlPayload = {
  crawlJobId: string;
  sessionId: string;
  query: ProductQuery;
  userId?: string;
  generationJobId?: string;
  /** Target look panel when patching async crawl results back into the job */
  lookIndex?: number;
  rankingContext?: RankingContext;
};

let inlineProductCrawlQueue: Promise<void> = Promise.resolve();

export async function enqueueProductCrawl(params: {
  sessionId: string;
  query: ProductQuery;
  userId?: string;
  generationJobId?: string;
  lookIndex?: number;
  rankingContext?: RankingContext;
}): Promise<string> {
  const crawlJob = await prisma.crawlJob.create({
    data: {
      query: params.query.query,
      region: params.query.region,
      category: params.query.category,
      status: CrawlJobStatus.QUEUED,
      provider: "crawl",
      sessionId: params.sessionId,
    },
  });

  const payload: ProductCrawlPayload = {
    crawlJobId: crawlJob.id,
    sessionId: params.sessionId,
    query: params.query,
    userId: params.userId,
    generationJobId: params.generationJobId,
    lookIndex: params.lookIndex,
    rankingContext: params.rankingContext,
  };

  if (process.env.INNGEST_EVENT_KEY) {
    await inngest.send({ name: PRODUCT_CRAWL_EVENT, data: payload });
    return crawlJob.id;
  }

  // Inline fallback for local dev without Inngest
  const { processProductCrawlJob } = await import("@/lib/jobs/product-crawl");
  inlineProductCrawlQueue = inlineProductCrawlQueue
    .catch(() => {
      // Keep the queue alive after a failed crawl.
    })
    .then(() => processProductCrawlJob(payload))
    .catch((e) => console.warn("Inline product crawl failed:", e));
  return crawlJob.id;
}

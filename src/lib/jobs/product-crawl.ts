import { CrawlJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crawlProductsLive } from "@/lib/ecommerce/providers/crawl-live";
import { upsertProductIndexBatch } from "@/lib/ecommerce/index/persist";
import { rankProductList } from "@/lib/ecommerce/ranking";
import {
  getProductSearchSession,
  updateProductSearchSession,
} from "@/lib/ecommerce/session";
import { setCachedProducts } from "@/lib/ecommerce/cache";
import { productToNormalized } from "@/lib/ecommerce/product";
import { dedupeProducts } from "@/lib/ecommerce/dedupe";
import type { ProductCrawlPayload } from "@/lib/ecommerce/crawl-queue";

export async function processProductCrawlJob(
  payload: ProductCrawlPayload
): Promise<void> {
  const { crawlJobId, sessionId, query, rankingContext } = payload;

  await prisma.crawlJob.update({
    where: { id: crawlJobId },
    data: { status: CrawlJobStatus.PROCESSING, startedAt: new Date() },
  });

  try {
    const crawled = await crawlProductsLive(query);
    await upsertProductIndexBatch(crawled, { embed: true });

    const session = await getProductSearchSession(sessionId);
    const existing = session?.products ?? [];
    const merged = dedupeProducts([...existing, ...crawled]);

    const ranked = await rankProductList(merged, {
      query,
      personAnalysis: rankingContext?.personAnalysis,
      plannedLook: rankingContext?.plannedLook,
    });

    const minResults = Number(process.env.PRODUCT_CRAWL_MIN_RESULTS ?? 4);
    const status = ranked.length >= minResults ? "ready" : "partial";

    await updateProductSearchSession(sessionId, {
      products: ranked,
      status,
      providerMeta: {
        degraded: false,
        providersUsed: ["crawl", "index"],
      },
    });

    await setCachedProducts(query, ranked.map((p) => productToNormalized(p)));

    // Index + session only. Never patch the saved generation result — extra
    // products found after render would show a shop link for a garment that
    // is not on the board.

    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: CrawlJobStatus.DONE,
        resultCount: crawled.length,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crawl failed";
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: CrawlJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
    await updateProductSearchSession(sessionId, {
      status: "failed",
      providerMeta: {
        degraded: true,
        failures: [{ system: "crawl", provider: "crawl", message }],
      },
    });
    throw e;
  }
}

import { inngest } from "@/inngest/client";
import {
  crawlAndIndexCategory,
  FASHION_INDEX_CATEGORIES,
  FASHION_INDEX_REGIONS,
} from "@/lib/jobs/fashion-index-crawl";

/**
 * Nightly proactive fashion index backfill.
 *
 * Pre-crawls category × region seeds across all configured retailers so
 * daytime generation hits the owned pgvector catalog instead of live crawls.
 */
export const fashionIndexCrawlFn = inngest.createFunction(
  {
    id: "aurafit-fashion-index-crawl",
    name: "Fashion Index: Nightly Crawl",
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    let totalIndexed = 0;

    for (const category of FASHION_INDEX_CATEGORIES) {
      for (const region of FASHION_INDEX_REGIONS) {
        const stepId = `index-${category.replace(/\s+/g, "-")}-${region}`;
        const result = await step.run(stepId, async () => {
          try {
            return await crawlAndIndexCategory({
              category,
              region,
              maxResults: 20,
            });
          } catch (e) {
            console.warn(`fashion-index-crawl ${stepId} failed:`, e);
            return { indexed: 0 };
          }
        });
        totalIndexed += result.indexed;
      }
    }

    return { totalIndexed, categories: FASHION_INDEX_CATEGORIES.length };
  }
);

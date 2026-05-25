import { inngest } from "@/inngest/client";
import { PRODUCT_CRAWL_EVENT } from "@/lib/ecommerce/crawl-queue";
import { processProductCrawlJob } from "@/lib/jobs/product-crawl";
import type { ProductCrawlPayload } from "@/lib/ecommerce/crawl-queue";

export const productCrawlFn = inngest.createFunction(
  {
    id: "aurafit-product-crawl",
    name: "Product live crawl",
    triggers: [{ event: PRODUCT_CRAWL_EVENT }],
  },
  async ({ event }) => {
    await processProductCrawlJob(event.data as ProductCrawlPayload);
  }
);

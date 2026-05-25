import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generationJobFn } from "@/inngest/functions/generation-job";
import { productCrawlFn } from "@/inngest/functions/product-crawl";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generationJobFn, productCrawlFn],
});

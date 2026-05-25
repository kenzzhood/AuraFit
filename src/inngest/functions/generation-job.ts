import { inngest, GENERATION_EVENT } from "@/inngest/client";
import { processGenerationJob } from "@/lib/jobs/generation";
import type { QueueJobPayload } from "@/lib/queue/producer";

export const generationJobFn = inngest.createFunction(
  {
    id: "aurafit-generation",
    name: "Process outfit generation",
    triggers: [{ event: GENERATION_EVENT }],
  },
  async ({ event }) => {
    await processGenerationJob(event.data as QueueJobPayload);
  }
);

import { inngest, GENERATION_EVENT } from "@/inngest/client";
import type { QueueJobPayload, QueueProvider } from "./types";

export const inngestQueueProvider: QueueProvider = {
  name: "inngest",
  isConfigured: () => !!process.env.INNGEST_EVENT_KEY,
  async enqueueGeneration(body: QueueJobPayload) {
    await inngest.send({ name: GENERATION_EVENT, data: body });
    return true;
  },
};

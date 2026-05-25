import type { QueueJobPayload, QueueProvider } from "./types";

/** Signals caller to run job inline via Next.js after() */
export const inlineQueueProvider: QueueProvider = {
  name: "inline",
  isConfigured: () => true,
  async enqueueGeneration(_body: QueueJobPayload) {
    return false;
  },
};

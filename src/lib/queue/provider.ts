import { parseProviderOrder } from "@/lib/providers/env";
import { inngestQueueProvider } from "./providers/inngest";
import { serviceBusQueueProvider } from "./providers/service-bus";
import { inlineQueueProvider } from "./providers/inline";
import type { QueueJobPayload, QueueProvider } from "./providers/types";

const REGISTRY: Record<string, QueueProvider> = {
  inngest: inngestQueueProvider,
  "service-bus": serviceBusQueueProvider,
  inline: inlineQueueProvider,
};

export function getQueueProvidersOrdered(): QueueProvider[] {
  const order = parseProviderOrder("QUEUE_PROVIDERS", [
    "inngest",
    "service-bus",
    "inline",
  ]);
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is QueueProvider => !!p);
}

export async function tryRemoteEnqueueGeneration(
  body: QueueJobPayload
): Promise<boolean> {
  const providers = getQueueProvidersOrdered();
  for (const p of providers) {
    if (!p.isConfigured()) continue;
    try {
      const ok = await p.enqueueGeneration(body);
      if (ok) return true;
      if (p.name === "inline") return false;
    } catch (e) {
      console.warn(`[queue] ${p.name} failed:`, e);
    }
  }
  return false;
}

export type { QueueJobPayload } from "./providers/types";

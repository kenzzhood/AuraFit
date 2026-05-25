import { ServiceBusClient } from "@azure/service-bus";
import {
  tryRemoteEnqueueGeneration,
  type QueueJobPayload,
} from "@/lib/queue/provider";

export type { QueueJobPayload } from "@/lib/queue/provider";

let serviceBusClient: ServiceBusClient | null = null;

function getServiceBusClient(): ServiceBusClient {
  const conn = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
  if (!conn) {
    throw new Error("AZURE_SERVICE_BUS_CONNECTION_STRING is not set");
  }
  if (!serviceBusClient) serviceBusClient = new ServiceBusClient(conn);
  return serviceBusClient;
}

async function serviceBusEnqueue(
  queueEnvKey: "analysis" | "generation" | "products",
  body: QueueJobPayload
): Promise<void> {
  const name =
    queueEnvKey === "analysis"
      ? process.env.AZURE_SERVICE_BUS_QUEUE_ANALYSIS
      : queueEnvKey === "generation"
        ? process.env.AZURE_SERVICE_BUS_QUEUE_GENERATION
        : process.env.AZURE_SERVICE_BUS_QUEUE_PRODUCTS;
  if (!name) {
    throw new Error(`Missing queue env for ${queueEnvKey}`);
  }
  const sender = getServiceBusClient().createSender(name);
  try {
    await sender.sendMessages({
      body,
      contentType: "application/json",
    });
  } finally {
    await sender.close();
  }
}

export { tryRemoteEnqueueGeneration };

export async function enqueueJob(
  queueEnvKey: "analysis" | "generation" | "products",
  body: QueueJobPayload
): Promise<void> {
  if (queueEnvKey === "generation") {
    const ok = await tryRemoteEnqueueGeneration(body);
    if (!ok) {
      throw new Error("DEFERRED_GENERATION");
    }
    return;
  }
  await serviceBusEnqueue(queueEnvKey, body);
}

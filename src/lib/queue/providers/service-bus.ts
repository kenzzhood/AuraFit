import { ServiceBusClient } from "@azure/service-bus";
import type { QueueJobPayload, QueueProvider } from "./types";

let serviceBusClient: ServiceBusClient | null = null;

function getClient(): ServiceBusClient {
  const conn = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_SERVICE_BUS_CONNECTION_STRING is not set");
  if (!serviceBusClient) serviceBusClient = new ServiceBusClient(conn);
  return serviceBusClient;
}

export const serviceBusQueueProvider: QueueProvider = {
  name: "service-bus",
  isConfigured: () => !!process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
  async enqueueGeneration(body: QueueJobPayload) {
    const name = process.env.AZURE_SERVICE_BUS_QUEUE_GENERATION;
    if (!name) throw new Error("Missing AZURE_SERVICE_BUS_QUEUE_GENERATION");
    const sender = getClient().createSender(name);
    try {
      await sender.sendMessages({
        body,
        contentType: "application/json",
      });
    } finally {
      await sender.close();
    }
    return true;
  },
};

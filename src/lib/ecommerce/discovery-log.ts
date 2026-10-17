import { randomUUID } from "crypto";
import type { DiscoveryFlags } from "@/lib/flags";
import { prisma } from "@/lib/prisma";
import { retailerDomain } from "./fingerprint";
import type { Product } from "./product";
import type { ProductQuery } from "./providers/types";

/**
 * One row per discovery call. Hosts, sources, and short titles only.
 * Never include API keys or raw provider payloads.
 */
export async function writeDiscoveryLog(params: {
  userId?: string;
  query: ProductQuery;
  products: Product[];
  providersUsed: string[];
  latencyMs: number;
  flags: DiscoveryFlags;
}): Promise<void> {
  const bySource: Record<string, number> = {};
  const byHost: Record<string, number> = {};
  for (const product of params.products) {
    const source = product.source || "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
    const host = retailerDomain(product.canonicalUrl ?? product.url) || "unknown";
    byHost[host] = (byHost[host] ?? 0) + 1;
  }

  const picks = params.products.slice(0, 20).map((product) => ({
    host: retailerDomain(product.canonicalUrl ?? product.url) || "unknown",
    source: product.source,
    title: product.title.slice(0, 80),
  }));

  try {
    await prisma.discoveryLog.create({
      data: {
        requestId: randomUUID(),
        userId: params.userId,
        intent: {
          query: params.query.query,
          category: params.query.category ?? null,
          region: params.query.region ?? null,
        },
        poolBySource: { ...bySource, providers: params.providersUsed },
        poolByHost: byHost,
        picks,
        latencyMs: params.latencyMs,
        flags: params.flags,
      },
    });
  } catch (e) {
    console.warn(
      "discovery log skipped:",
      e instanceof Error ? e.message : "write failed"
    );
  }
}

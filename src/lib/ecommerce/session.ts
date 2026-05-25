import { ProductSearchSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Product } from "./product";
import type { ProviderMeta } from "@/lib/providers/types";
import type { ProductQuery } from "./providers/types";

export type SessionStatus = "partial" | "ready" | "failed";

export async function createProductSearchSession(params: {
  userId?: string;
  generationJobId?: string;
  query: ProductQuery;
  products?: Product[];
  status?: SessionStatus;
  providerMeta?: ProviderMeta;
}): Promise<string> {
  const status =
    params.status === "ready"
      ? ProductSearchSessionStatus.READY
      : params.status === "failed"
        ? ProductSearchSessionStatus.FAILED
        : ProductSearchSessionStatus.PARTIAL;

  const row = await prisma.productSearchSession.create({
    data: {
      userId: params.userId,
      generationJobId: params.generationJobId,
      query: params.query.query,
      region: params.query.region,
      category: params.query.category,
      status,
      productsJson: (params.products ?? []) as object,
      providerMeta: params.providerMeta as object,
      budgetMin: params.query.budgetMin,
      budgetMax: params.query.budgetMax,
      aestheticKeywords: params.query.aestheticKeywords as object,
    },
  });
  return row.id;
}

export async function updateProductSearchSession(
  sessionId: string,
  params: {
    products?: Product[];
    status?: SessionStatus;
    providerMeta?: ProviderMeta;
  }
): Promise<void> {
  const status = params.status
    ? params.status === "ready"
      ? ProductSearchSessionStatus.READY
      : params.status === "failed"
        ? ProductSearchSessionStatus.FAILED
        : ProductSearchSessionStatus.PARTIAL
    : undefined;

  await prisma.productSearchSession.update({
    where: { id: sessionId },
    data: {
      ...(params.products ? { productsJson: params.products as object } : {}),
      ...(status ? { status } : {}),
      ...(params.providerMeta
        ? { providerMeta: params.providerMeta as object }
        : {}),
    },
  });
}

export async function getProductSearchSession(sessionId: string) {
  const row = await prisma.productSearchSession.findUnique({
    where: { id: sessionId },
  });
  if (!row) return null;

  const statusMap: Record<ProductSearchSessionStatus, SessionStatus> = {
    PARTIAL: "partial",
    READY: "ready",
    FAILED: "failed",
  };

  return {
    id: row.id,
    query: row.query,
    region: row.region,
    category: row.category,
    status: statusMap[row.status],
    products: (row.productsJson as Product[]) ?? [],
    providerMeta: row.providerMeta as ProviderMeta | undefined,
    generationJobId: row.generationJobId,
  };
}

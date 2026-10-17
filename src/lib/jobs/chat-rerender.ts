import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { personAnalysisToPromptBlock } from "@/lib/ai/person-analysis";
import { discoverProducts, locationToRegion } from "@/lib/ecommerce/discovery";
import { canonicalItemCategory } from "@/lib/ecommerce/category-match";
import { joinShoppingStyle } from "@/lib/ecommerce/aesthetic";
import { productToNormalized, type Product } from "@/lib/ecommerce/product";
import { pickUsableShopUrl } from "@/lib/ecommerce/fingerprint";
import {
  generateBoardWithFallback,
  isImageGenerationConfigured,
} from "@/lib/image/provider";
import { prefetchProductImageUrls } from "@/lib/azure/images";
import { getStorageProvider } from "@/lib/storage/provider";
import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/storage/cloudinary";
import {
  buildFashionBoardPrompt,
  buildProductImageRefs,
  cacheProduct,
  compactProductImageRefs,
  isRealProduct,
  MAX_PRODUCT_IMAGE_REFS,
  shoppingSlotsForLook,
} from "@/lib/jobs/generation";
import { persistChatJobResultToMessages } from "@/lib/jobs/persist-chat-result";
import type {
  GenerationJobResult,
  LookProduct,
  PlannedLook,
} from "@/types/generation";

async function uploadBoardImage(
  userId: string,
  image: { url?: string; buffer?: Buffer }
): Promise<string | null> {
  let buffer = image.buffer;
  if (!buffer && image.url) {
    const res = await fetch(image.url);
    if (!res.ok) return image.url;
    buffer = Buffer.from(await res.arrayBuffer());
  }
  if (!buffer) return image.url ?? null;

  if (isCloudinaryConfigured()) {
    const { url } = await uploadImageBuffer({
      buffer,
      folder: `aurafit/${userId}/outfit_render`,
      publicIdStem: `board-chat-${Date.now()}`,
    });
    return url;
  }

  const storage = getStorageProvider();
  if (storage.isConfigured() && !isCloudinaryConfigured()) {
    const up = await storage.upload({
      buffer,
      folder: `aurafit/${userId}/outfit_render`,
      publicIdStem: `board-chat-${Date.now()}`,
      contentType: "image/png",
    });
    return up.url;
  }

  return image.url ?? null;
}

async function lookProductFromDiscovered(
  p: Product,
  category: string
): Promise<LookProduct | null> {
  const productUrl = pickUsableShopUrl(p.canonicalUrl, p.url);
  if (!productUrl) return null;
  const verified = p.verified === true || p.pdpVerified === true;
  if (
    !isRealProduct({
      productUrl,
      imageUrl: p.image,
      source: p.source,
      verified,
      availability: p.availability,
    })
  ) {
    return null;
  }
  const norm = productToNormalized({ ...p, url: productUrl });
  const row = await cacheProduct({
    ...norm,
    productUrl,
    canonicalUrl: productUrl,
  });
  return {
    title: norm.title,
    productUrl,
    source: norm.source,
    productCacheId: row.id,
    price: norm.price,
    currency: norm.currency,
    imageUrl: norm.imageUrl,
    storeName: norm.storeName,
    verified: true,
    canonicalUrl: productUrl,
    availability: norm.availability ?? "in_stock",
    matchCategory: category,
    kind: "online",
  };
}

async function billingReservationIdFromJob(
  jobId: string
): Promise<string | null> {
  const row = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  });
  const payload = row?.payload as { billingReservationId?: unknown } | null;
  return typeof payload?.billingReservationId === "string"
    ? payload.billingReservationId
    : null;
}

export async function processChatRerender(params: {
  userId: string;
  jobId: string;
  lookIndex: number;
  category: string;
  instruction?: string;
}): Promise<{ boardImageUrl: string }> {
  const job = await prisma.generationJob.findFirst({
    where: {
      id: params.jobId,
      userId: params.userId,
      jobType: JobType.GENERATION,
    },
  });
  if (!job?.result) {
    throw new Error("Chat look job not found");
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  if (payload.source !== "chat") {
    throw new Error("Not a chat generation job");
  }

  const prev = job.result as GenerationJobResult;
  const looks = [...(prev.looks ?? [])];
  const look = looks[params.lookIndex];
  if (!look) {
    throw new Error("Look not found");
  }

  const category = canonicalItemCategory(params.category);
  const planned: PlannedLook = {
    label: look.label,
    tagline: look.tagline,
    description: look.description,
    bestFor: look.bestFor,
    priceRange: look.priceRange,
    productSearchQuery: look.productSearchQuery,
    items: look.items,
  };
  const slots = shoppingSlotsForLook(
    planned,
    joinShoppingStyle({
      styleType:
        typeof payload.styleType === "string" ? payload.styleType : undefined,
      occasion:
        typeof payload.occasion === "string" ? payload.occasion : undefined,
      style: typeof payload.style === "string" ? payload.style : undefined,
    })
  );
  const slot =
    slots.find((s) => canonicalItemCategory(s.category) === category) ?? {
      category,
      searchQuery: `${category} ${look.label}`,
    };
  const searchQuery = [params.instruction, slot.searchQuery, look.productSearchQuery]
    .filter(Boolean)
    .join(" ");

  const region = locationToRegion(
    typeof payload.location === "string" ? payload.location : undefined
  );
  const budgetMax =
    typeof payload.budgetMax === "number" ? payload.budgetMax : undefined;

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { progress: 35, status: JobStatus.PROCESSING },
  });

  const discovered = await discoverProducts({
    query: {
      query: searchQuery || `${category} fashion`,
      category,
      region,
      budgetMax,
    },
    userId: params.userId,
    generationJobId: job.id,
    syncCrawlFallback: true,
  });

  const usedUrls = new Set(
    (look.products ?? [])
      .map((p) => p.productUrl)
      .filter((u): u is string => !!u)
  );

  let replacement: LookProduct | null = null;
  for (const p of discovered.products) {
    const next = await lookProductFromDiscovered(p, category);
    if (!next?.productUrl || usedUrls.has(next.productUrl)) continue;
    replacement = next;
    break;
  }
  if (!replacement) {
    throw new Error("No shoppable replacement found for that slot");
  }

  const products = [...(look.products ?? [])];
  const slotIdx = products.findIndex(
    (p) => canonicalItemCategory(p.matchCategory) === category
  );
  if (slotIdx >= 0) {
    products[slotIdx] = { ...products[slotIdx], ...replacement };
  } else {
    products.push(replacement);
  }
  looks[params.lookIndex] = { ...look, products };

  const path = (payload.path as "online" | "wardrobe" | undefined) ?? "online";
  const built = buildProductImageRefs(
    looks.map((l) => ({ products: (l.products ?? []) as LookProduct[] })),
    { includeWardrobe: true }
  );
  const uploadedUrls = await prefetchProductImageUrls(
    built.productImageUrls,
    MAX_PRODUCT_IMAGE_REFS
  );
  const productImageRefs = compactProductImageRefs(
    built.productImageRefs,
    uploadedUrls
  );
  const productImageUrls = uploadedUrls.filter((u) =>
    productImageRefs.some((r) => r.imageUrl === u)
  );
  const densifiedRefs = compactProductImageRefs(
    productImageRefs,
    productImageUrls
  );

  const prompt = buildFashionBoardPrompt({
    personBlock: personAnalysisToPromptBlock(prev.personAnalysis ?? null),
    styleType: payload.styleType as string | undefined,
    occasion: payload.occasion as string | undefined,
    location: payload.location as string | undefined,
    style: payload.style as string | undefined,
    budgetMin: payload.budgetMin as number | undefined,
    budgetMax: payload.budgetMax as number | undefined,
    path,
    looks,
    productImageRefs: densifiedRefs,
    requireProductRefsPerPanel: true,
  });

  if (!isImageGenerationConfigured()) {
    throw new Error("Image generation is not configured");
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { progress: 70 },
  });

  const userPhotoUrl =
    (payload.userPhotoUrl as string | undefined) ?? undefined;
  const { value: boardImage } = await generateBoardWithFallback({
    prompt,
    quality: "medium",
    referenceImageUrl: userPhotoUrl,
    productImageUrls,
  });
  const boardImageUrl = await uploadBoardImage(params.userId, boardImage);
  if (!boardImageUrl) {
    throw new Error("Board re-render produced no image");
  }

  const updated: GenerationJobResult = {
    ...prev,
    boardImageUrl,
    looks,
    renderQuality: "medium",
    previewOnly: false,
  };

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: JobStatus.DONE,
      progress: 100,
      error: null,
      result: updated as object,
    },
  });

  await persistChatJobResultToMessages({
    userId: params.userId,
    conversationId:
      typeof payload.conversationId === "string"
        ? payload.conversationId
        : undefined,
    source: typeof payload.source === "string" ? payload.source : undefined,
    jobId: job.id,
    boardImageUrl,
    looks,
  }).catch(() => undefined);

  const reservationId = await billingReservationIdFromJob(job.id);
  if (reservationId) {
    const { finalizeUsage } = await import("@/lib/billing/entitlements");
    await finalizeUsage(reservationId, true, job.id).catch(() => undefined);
  }

  return { boardImageUrl };
}

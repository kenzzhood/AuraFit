import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { personAnalysisToPromptBlock } from "@/lib/ai/person-analysis";
import type { GenerationJobResult, LookProduct } from "@/types/generation";
import { getStorageProvider } from "@/lib/storage/provider";
import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/storage/cloudinary";
import {
  generateBoardWithFallback,
  isImageGenerationConfigured,
} from "@/lib/image/provider";
import {
  buildFashionBoardPrompt,
  buildProductImageRefs,
  compactProductImageRefs,
  MAX_PRODUCT_IMAGE_REFS,
} from "@/lib/jobs/generation";
import { prefetchProductImageUrls } from "@/lib/azure/images";

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
      publicIdStem: `board-hd-${Date.now()}`,
    });
    return url;
  }

  const storage = getStorageProvider();
  if (storage.isConfigured() && !isCloudinaryConfigured()) {
    const up = await storage.upload({
      buffer,
      folder: `aurafit/${userId}/outfit_render`,
      publicIdStem: `board-hd-${Date.now()}`,
      contentType: "image/png",
    });
    return up.url;
  }

  return image.url ?? null;
}

export async function processHdRenderJob(params: {
  userId: string;
  parentJobId: string;
  lookIndex?: number;
}): Promise<{ boardImageUrl: string | null }> {
  const parent = await prisma.generationJob.findFirst({
    where: { id: params.parentJobId, userId: params.userId },
  });
  if (!parent?.result) {
    throw new Error("Parent generation job not found");
  }

  const prev = parent.result as GenerationJobResult;

  const personBlock = personAnalysisToPromptBlock(
    prev.personAnalysis ?? null
  );
  const allLooks = prev.looks ?? [];
  const heroIndex =
    params.lookIndex != null &&
    params.lookIndex >= 0 &&
    params.lookIndex < allLooks.length
      ? params.lookIndex
      : undefined;
  const looks =
    heroIndex != null ? [allLooks[heroIndex]!] : allLooks;
  const payload = parent.payload as Record<string, unknown> | null;
  const path = (payload?.path as "online" | "wardrobe" | undefined) ?? "online";

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
    personBlock,
    styleType: payload?.styleType as string | undefined,
    occasion: payload?.occasion as string | undefined,
    location: payload?.location as string | undefined,
    style: payload?.style as string | undefined,
    budgetMin: payload?.budgetMin as number | undefined,
    budgetMax: payload?.budgetMax as number | undefined,
    path,
    looks,
    productImageRefs: densifiedRefs,
    requireProductRefsPerPanel: true,
  });

  let boardImageUrl: string | null = null;
  const providerMeta = { ...(prev.providerMeta ?? {}) };

  if (isImageGenerationConfigured()) {
    try {
      const userPhotoUrl =
        (payload?.userPhotoUrl as string | undefined) ?? undefined;
      const { value: boardImage, meta } = await generateBoardWithFallback({
        prompt,
        quality: "hd",
        referenceImageUrl: userPhotoUrl,
        productImageUrls,
      });
      boardImageUrl = await uploadBoardImage(params.userId, boardImage);
      if (meta.degraded) {
        providerMeta.degraded = true;
        providerMeta.failures = [
          ...(providerMeta.failures ?? []),
          ...(meta.failures ?? []),
        ];
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "HD render failed";
      providerMeta.degraded = true;
      providerMeta.failures = [
        ...(providerMeta.failures ?? []),
        { system: "image", provider: "all", message },
      ];
    }
  } else {
    providerMeta.degraded = true;
    providerMeta.failures = [
      ...(providerMeta.failures ?? []),
      {
        system: "image",
        provider: "all",
        message: "Image generation not configured",
      },
    ];
  }

  const updated: GenerationJobResult = {
    ...prev,
    boardImageUrl,
    renderQuality: "hd",
    previewOnly: false,
    providerMeta,
  };

  await prisma.generationJob.update({
    where: { id: params.parentJobId },
    data: { result: updated as object },
  });

  return { boardImageUrl };
}

export async function createHdRenderJob(params: {
  userId: string;
  parentJobId: string;
  lookIndex?: number;
}) {
  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      jobType: JobType.GENERATION,
      status: JobStatus.QUEUED,
      payload: {
        type: "HD_RENDER",
        parentJobId: params.parentJobId,
        lookIndex: params.lookIndex,
      },
    },
  });

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PROCESSING, progress: 10 },
  });

  try {
    const { boardImageUrl } = await processHdRenderJob({
      userId: params.userId,
      parentJobId: params.parentJobId,
      lookIndex: params.lookIndex,
    });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.DONE,
        progress: 100,
        result: { boardImageUrl, parentJobId: params.parentJobId } as object,
      },
    });
    return job.id;
  } catch (e) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error: e instanceof Error ? e.message : "HD render failed",
      },
    });
    throw e;
  }
}

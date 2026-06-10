import OpenAI, { toFile } from "openai";
import {
  assertAllowedUserMediaUrl,
  assertSafeExternalUrl,
} from "@/lib/security/ssrf";

function getImageEndpointAndKey(): { endpoint?: string; apiKey?: string } {
  return {
    endpoint:
      process.env.AZURE_OPENAI_IMAGE_ENDPOINT ??
      process.env.AZURE_OPENAI_ENDPOINT,
    apiKey:
      process.env.AZURE_OPENAI_IMAGE_API_KEY ??
      process.env.AZURE_OPENAI_API_KEY,
  };
}

function getImageClient(): OpenAI {
  const { endpoint, apiKey } = getImageEndpointAndKey();
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE ?? "dall-e-3";
  const apiVersion =
    process.env.AZURE_OPENAI_IMAGE_API_VERSION ??
    process.env.AZURE_OPENAI_API_VERSION ??
    "2025-04-01-preview";

  if (!endpoint || !apiKey) {
    throw new Error(
      "Missing AZURE_OPENAI_IMAGE_ENDPOINT/AZURE_OPENAI_ENDPOINT or matching API key"
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`,
    defaultQuery: { "api-version": apiVersion },
    defaultHeaders: { "api-key": apiKey },
  });
}

export function isAzureImageGenerationConfigured(): boolean {
  const { endpoint, apiKey } = getImageEndpointAndKey();
  return !!(endpoint && apiKey);
}

export type FashionBoardImage = {
  /** Remote URL from Azure (may expire) or data URL */
  url?: string;
  /** Raw PNG bytes when Azure returns b64_json */
  buffer?: Buffer;
};

export type BoardQuality = "preview" | "medium" | "hd";

/**
 * Generate a single 6-panel fashion styling board image via Azure OpenAI Images.
 * Supports both gpt-image-* (preferred) and legacy dall-e-3 deployments.
 *
 * Cost per call (gpt-image-2 GlobalStandard):
 *   - quality "low"    ≈ $0.008
 *   - quality "medium" ≈ $0.032
 *   - quality "high"   ≈ $0.125
 */
type FetchedImageFile = {
  file: Awaited<ReturnType<typeof toFile>>;
  byteLength: number;
  contentType: string;
};

async function fetchAsToFile(
  url: string,
  fallbackName: string,
  options?: { userMediaOnly?: boolean }
): Promise<FetchedImageFile> {
  if (options?.userMediaOnly) {
    assertAllowedUserMediaUrl(url);
  } else {
    assertSafeExternalUrl(url);
  }
  // Per-image fetch timeout. One dead/slow product thumbnail must NOT stall
  // the whole multi-image edit payload — we'd rather drop that ref and let
  // Promise.allSettled in the caller collect whatever finished in time.
  const fetched = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!fetched.ok) {
    throw new Error(
      `image fetch failed (${url}): ${fetched.status} ${fetched.statusText}`
    );
  }
  const contentType = fetched.headers.get("content-type") ?? "image/jpeg";
  const arrayBuf = await fetched.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const file = await toFile(buf, `${fallbackName}.${ext}`, {
    type: contentType,
  });
  return { file, byteLength: buf.length, contentType };
}

function extractImage(
  first: { b64_json?: string | null; url?: string | null } | undefined,
  label: string
): FashionBoardImage {
  if (!first) {
    throw new Error(`Azure ${label} returned no data`);
  }
  if (first.b64_json) {
    return { buffer: Buffer.from(first.b64_json, "base64") };
  }
  if (first.url) {
    return { url: first.url };
  }
  throw new Error(`Azure ${label} returned no url or b64_json`);
}

export async function generateFashionBoard(
  prompt: string,
  quality: BoardQuality = "hd",
  referenceImageUrl?: string,
  productImageUrls?: string[]
): Promise<FashionBoardImage> {
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT_IMAGE ?? "dall-e-3";
  const client = getImageClient();

  const isGptImage = deployment.includes("gpt-image");
  const gptImageQuality =
    quality === "hd" ? "high" : quality === "medium" ? "medium" : "low";

  // Edit endpoint only supported by gpt-image-*. If no user photo is given, we
  // can't preserve identity — fall straight through to text-only generation.
  const canEdit = isGptImage && !!referenceImageUrl;

  // Cap product references aggressively. Each extra ref adds upload latency
  // and slows the model. 4 product images + 1 user photo = 5 total, well
  // within gpt-image-2's accepted input set, and 3× faster end-to-end than
  // shipping the previous cap of 12 thumbnails.
  const productUrls = (productImageUrls ?? [])
    .filter((u) => typeof u === "string" && u.length > 0)
    .slice(0, 4);
  const hasProductRefs = canEdit && productUrls.length > 0;

  // Hard ceiling on each Azure image API call. gpt-image-2 normally responds
  // in 30–60 s; anything longer is a stuck request and we want to fail loud
  // and let the job mark itself degraded rather than hang the worker.
  const IMAGE_API_TIMEOUT_MS = 90_000;

  // === Level 1: multi-image edit (user photo + product images) ===========
  if (hasProductRefs) {
    try {
      const userPhoto = await fetchAsToFile(
        referenceImageUrl!,
        "reference-person",
        { userMediaOnly: true }
      );
      // Fetch product images in parallel; tolerate individual failures so one
      // dead thumbnail URL doesn't blow up the whole call.
      const productResults = await Promise.allSettled(
        productUrls.map((u, i) => fetchAsToFile(u, `product-${i + 1}`))
      );
      const productFiles = productResults
        .filter(
          (r): r is PromiseFulfilledResult<FetchedImageFile> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);

      if (productFiles.length > 0) {
        const imageArray = [
          userPhoto.file,
          ...productFiles.map((p) => p.file),
        ];
        const editResponse = await client.images.edit(
          {
            model: deployment,
            prompt,
            // gpt-image-* supports an array of images for multi-reference edits.
            image: imageArray as unknown as Parameters<
              typeof client.images.edit
            >[0]["image"],
            n: 1,
            size: "1536x1024",
            quality: gptImageQuality as "low" | "medium" | "high",
          },
          { timeout: IMAGE_API_TIMEOUT_MS }
        );
        return extractImage(editResponse.data?.[0], "multi-image edit");
      }
      // If every product fetch failed, drop down to single-image edit.
    } catch {
      // fall through to single-edit
    }
  }

  // === Level 2: single-image edit (user photo only) ======================
  if (canEdit) {
    try {
      const userPhoto = await fetchAsToFile(
        referenceImageUrl!,
        "reference-person",
        { userMediaOnly: true }
      );

      const editResponse = await client.images.edit(
        {
          model: deployment,
          prompt,
          image: userPhoto.file,
          n: 1,
          size: "1536x1024",
          quality: gptImageQuality as "low" | "medium" | "high",
        },
        { timeout: IMAGE_API_TIMEOUT_MS }
      );
      return extractImage(editResponse.data?.[0], "image edit");
    } catch {
      // fall through to text-only generation
    }
  }

  // === Level 3: text-only generation =====================================
  const response = await client.images.generate(
    {
      model: deployment,
      prompt,
      n: 1,
      size: isGptImage ? "1536x1024" : "1792x1024",
      ...(isGptImage
        ? { quality: gptImageQuality as "low" | "medium" | "high" }
        : { quality: "hd" as const, style: "natural" as const }),
    },
    { timeout: IMAGE_API_TIMEOUT_MS }
  );
  return extractImage(response.data?.[0], "image generation");
}

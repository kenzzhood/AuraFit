import OpenAI, { toFile } from "openai";
import {
  assertAllowedUserMediaUrl,
  assertSafeExternalUrl,
} from "@/lib/security/ssrf";
import { MAX_PRODUCT_IMAGE_REFS } from "@/lib/image/constants";
import { PRODUCT_IMAGE_USER_AGENT } from "@/lib/media/product-proxy";

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

const productImageCache = new Map<string, Promise<FetchedImageFile>>();

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
  // Manual redirects: re-validate each Location against SSRF guards.
  const { safeFetch } = await import("@/lib/security/ssrf");
  const fetched = await safeFetch(url, {
    signal: AbortSignal.timeout(5_000),
    maxRedirects: 2,
    headers: options?.userMediaOnly
      ? undefined
      : {
          "User-Agent": PRODUCT_IMAGE_USER_AGENT,
          Accept: "image/*",
        },
  });
  if (!fetched.ok) {
    let host = "invalid";
    try {
      host = new URL(url).hostname;
    } catch {
      /* keep invalid */
    }
    throw new Error(
      `image fetch failed (${host}): ${fetched.status} ${fetched.statusText}`
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

async function cachedProductFile(
  url: string,
  fallbackName: string
): Promise<FetchedImageFile> {
  const existing = productImageCache.get(url);
  if (existing) return existing;
  const pending = fetchAsToFile(url, fallbackName);
  productImageCache.set(url, pending);
  try {
    return await pending;
  } catch (e) {
    productImageCache.delete(url);
    throw e;
  }
}

/** Probe + cache product thumbnails so the prompt Image N matches uploaded files. */
export async function prefetchProductImageUrls(
  urls: string[],
  cap = MAX_PRODUCT_IMAGE_REFS
): Promise<string[]> {
  const unique = [
    ...new Set(urls.filter((u) => typeof u === "string" && u.length > 0)),
  ];
  const settled = await Promise.all(
    unique.map(async (u) => {
      try {
        await cachedProductFile(u, "product-prefetch");
        return u;
      } catch {
        return null;
      }
    })
  );
  const okUrls = settled.filter((u): u is string => !!u);
  const failed = settled.length - okUrls.length;
  if (failed > 0) {
    const hosts = [
      ...new Set(
        unique
          .filter((_, i) => !settled[i])
          .map((u) => {
            try {
              return new URL(u).hostname;
            } catch {
              return "invalid";
            }
          })
      ),
    ];
    console.warn(
      `[prefetchProductImageUrls] ok=${okUrls.length} failed=${failed} hosts=${hosts.join(",")}`
    );
  }
  return okUrls.slice(0, cap);
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

  // Cap product references. Generation already prefetches and passes only
  // reachable URLs; keep the array 1:1 with the prompt's Image 2..N.
  const productUrls = (productImageUrls ?? [])
    .filter((u) => typeof u === "string" && u.length > 0)
    .slice(0, MAX_PRODUCT_IMAGE_REFS);
  const hasProductRefs = canEdit && productUrls.length > 0;

  // Hard ceiling on each Azure image API call. gpt-image-2 normally responds
  // in 30–60 s; anything longer is a stuck request and we want to fail loud
  // and let the job mark itself degraded rather than hang the worker.
  const IMAGE_API_TIMEOUT_MS = 90_000;

  // === Level 1: multi-image edit (user photo + product images) ===========
  // When product refs are present we must not fall through to photo-only or
  // text-only generation — those paths invent garments that will not match
  // the shop links.
  if (hasProductRefs) {
    const userPhoto = await fetchAsToFile(
      referenceImageUrl!,
      "reference-person",
      { userMediaOnly: true }
    );
    const productFiles = await Promise.all(
      productUrls.map((u, i) => cachedProductFile(u, `product-${i + 1}`))
    );

    if (productFiles.length === 0) {
      throw new Error("product reference images failed to load");
    }

    const imageArray = [userPhoto.file, ...productFiles.map((p) => p.file)];
    const editResponse = await client.images.edit(
      {
        model: deployment,
        prompt,
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

import { runTryOnWithFallback } from "@/lib/tryon/provider";

/**
 * Virtual try-on with provider fallback (Replicate → no-op).
 */
export type TryOnResult =
  | { status: "ready"; imageUrl: string }
  | { status: "pending" | "error"; message: string };

export async function requestVirtualTryOnGrid(params: {
  personImageUrl: string;
  garmentImageUrls: string[];
}): Promise<TryOnResult> {
  const garmentUrl = params.garmentImageUrls.filter(Boolean)[0];
  if (!garmentUrl) {
    return {
      status: "pending",
      message: "No garment image provided for try-on.",
    };
  }

  try {
    const { value } = await runTryOnWithFallback({
      personImageUrl: params.personImageUrl,
      garmentImageUrl: garmentUrl,
    });

    if (value.available && value.imageUrl) {
      return { status: "ready", imageUrl: value.imageUrl };
    }

    return {
      status: "pending",
      message:
        value.message ??
        "Try-on unavailable, outfit details still ready.",
    };
  } catch (e) {
    return {
      status: "error",
      message:
        e instanceof Error
          ? e.message
          : "Try-on unavailable, outfit details still ready.",
    };
  }
}

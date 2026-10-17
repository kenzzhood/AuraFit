import {
  EntitlementError,
} from "@/lib/billing/entitlements";
import { firstAllowedImageUrl } from "./photo";
import { createWardrobeItemFromImage } from "./wardrobe";
import type { StylistToolContext, StylistToolResult } from "./types";

export async function handleSaveToWardrobe(
  ctx: StylistToolContext,
  _args: Record<string, unknown>
): Promise<StylistToolResult> {
  const imageUrl = firstAllowedImageUrl(ctx.imageUrls);
  if (!imageUrl) {
    return {
      ok: false,
      needPhoto: true,
      message: "Ask the user to attach a garment photo to save to their wardrobe.",
    };
  }

  try {
    const item = await createWardrobeItemFromImage({
      userId: ctx.userId,
      imageUrl,
    });
    return {
      ok: true,
      message: `Saved to wardrobe as ${item.category}${item.description ? ` (${item.description})` : ""}.`,
    };
  } catch (e) {
    if (e instanceof EntitlementError) {
      return {
        ok: false,
        error: e.message,
        code: e.code,
        message: e.message,
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save to wardrobe.",
    };
  }
}

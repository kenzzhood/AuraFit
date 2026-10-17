import { OutfitCategory } from "@prisma/client";
import { classifyGarment, describeGarment } from "@/lib/ai/garment-classifier";
import { analyzeFashionImage } from "@/lib/azure/vision";
import { discoverProducts, locationToRegion } from "@/lib/ecommerce/discovery";
import { prisma } from "@/lib/prisma";
import { firstAllowedImageUrl } from "./photo";
import { shoppableProductCards } from "./products";
import { buildVisualSearchQuery } from "./visual-query";
import type { StylistToolContext, StylistToolResult } from "./types";

export function outfitCategoryToSlot(category: OutfitCategory): string {
  switch (category) {
    case OutfitCategory.TOP:
      return "top";
    case OutfitCategory.BOTTOM:
      return "bottom";
    case OutfitCategory.DRESS:
      return "dress";
    case OutfitCategory.OUTERWEAR:
      return "outerwear";
    case OutfitCategory.FOOTWEAR:
      return "shoes";
    case OutfitCategory.ACCESSORY:
      return "accessory";
    default:
      return "top";
  }
}

export async function handleVisualSearch(
  ctx: StylistToolContext,
  args: Record<string, unknown>
): Promise<StylistToolResult> {
  const imageUrl = firstAllowedImageUrl(ctx.imageUrls);
  if (!imageUrl) {
    return {
      ok: false,
      needPhoto: true,
      message:
        "Ask the user to attach a photo of the garment so you can find closest shoppable matches.",
    };
  }

  const extraQuery = typeof args.query === "string" ? args.query : undefined;
  const [classified, described, vision] = await Promise.all([
    classifyGarment(imageUrl),
    describeGarment(imageUrl),
    analyzeFashionImage(imageUrl).catch(() => ({
      tags: [] as string[],
      caption: undefined as string | undefined,
    })),
  ]);

  const category = outfitCategoryToSlot(classified);
  const query = buildVisualSearchQuery({
    description: described,
    category,
    caption: vision.caption,
    tags: vision.tags,
    extraQuery,
  });

  const prefs = await prisma.stylePreference.findUnique({
    where: { userId: ctx.userId },
    select: { region: true },
  });
  const region = locationToRegion(prefs?.region);

  const discovered = await discoverProducts({
    query: {
      query: query || `${category} fashion`,
      category,
      region,
    },
    userId: ctx.userId,
  });

  const products = shoppableProductCards(discovered.products, {
    min: 4,
    max: 8,
    matchCategory: category,
  });

  if (!products.length) {
    return {
      ok: false,
      message:
        "No verified shoppable matches were found for that photo. Ask the user to try another angle or a clearer garment shot.",
    };
  }

  return {
    ok: true,
    products,
    message: `Closest shoppable matches (not an identical SKU) for "${described || category}". ${products.length} verified products. Present these as similar options the user can buy.`,
  };
}

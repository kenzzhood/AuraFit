import { OutfitCategory } from "@prisma/client";
import { classifyGarment, describeGarment } from "@/lib/ai/garment-classifier";
import {
  EntitlementError,
  assertCanGenerate,
} from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";
import { enqueueChatGenerationJob } from "./enqueue";
import { firstAllowedImageUrl, resolveUserPhotoUrl } from "./photo";
import { createWardrobeItemFromImage } from "./wardrobe";
import { outfitCategoryToSlot } from "./visual-search";
import type { StylistToolContext, StylistToolResult } from "./types";

export async function handleComboFromGarment(
  ctx: StylistToolContext,
  args: Record<string, unknown>
): Promise<StylistToolResult> {
  const garmentUrl = firstAllowedImageUrl(ctx.imageUrls);
  if (!garmentUrl) {
    return {
      ok: false,
      needPhoto: true,
      message:
        "Ask the user to attach a photo of the garment to build looks around.",
    };
  }

  const [classified, described] = await Promise.all([
    classifyGarment(garmentUrl),
    describeGarment(garmentUrl),
  ]);
  const slot = outfitCategoryToSlot(classified);
  const description = described || slot;

  let wardrobeItemId: string | undefined;
  try {
    const saved = await createWardrobeItemFromImage({
      userId: ctx.userId,
      imageUrl: garmentUrl,
      category: classified === OutfitCategory.OTHER ? undefined : classified,
    });
    wardrobeItemId = saved.id;
  } catch (e) {
    if (e instanceof EntitlementError) {
      // Still generate around the photo without saving.
      console.warn("combo_from_garment wardrobe save skipped:", e.message);
    } else {
      console.warn("combo_from_garment wardrobe save failed:", e);
    }
  }

  const selfieUrls = ctx.imageUrls?.filter((u) => u !== garmentUrl);
  const userPhotoUrl = await resolveUserPhotoUrl({
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    imageUrls: selfieUrls?.length ? selfieUrls : undefined,
    excludeUrls: [garmentUrl],
  });

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanGenerate(ctx.userId);
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return {
        ok: false,
        error: e.message,
        code: e.code,
        message: e.message,
      };
    }
    throw e;
  }

  const occasion =
    typeof args.occasion === "string" ? args.occasion : undefined;
  const location =
    typeof args.location === "string" ? args.location : undefined;
  const budgetMax =
    typeof args.budgetMax === "number" ? args.budgetMax : undefined;
  const styleNote = [
    typeof args.style === "string" ? args.style : "",
    `Keep the ${slot} locked: ${description}. Pair the rest of each look around that piece.`,
  ]
    .filter(Boolean)
    .join(" ");

  const prefs = await prisma.stylePreference.findUnique({
    where: { userId: ctx.userId },
    select: { region: true },
  });

  const jobId = await enqueueChatGenerationJob({
    userId: ctx.userId,
    reservationId,
    input: wardrobeItemId
      ? {
          path: "wardrobe",
          wardrobeMode: "pair",
          wardrobeItemIds: [wardrobeItemId],
          userPhotoUrl: userPhotoUrl ?? undefined,
          occasion,
          location: location ?? prefs?.region ?? undefined,
          budgetMax,
          style: styleNote,
          lookCount: 3,
          source: "chat",
          conversationId: ctx.conversationId,
          renderQuality: "medium",
        }
      : {
          path: "online",
          userPhotoUrl: userPhotoUrl ?? undefined,
          occasion,
          location: location ?? prefs?.region ?? undefined,
          budgetMax,
          style: styleNote,
          lookCount: 3,
          source: "chat",
          conversationId: ctx.conversationId,
          renderQuality: "medium",
        },
  });

  return {
    ok: true,
    jobId,
    status: "queued",
    message: wardrobeItemId
      ? `Queued 3 looks paired with the saved ${slot} (${description}). Job ${jobId}. This uses a look credit.`
      : `Queued 3 looks around this ${slot} (${description}) without saving it. Job ${jobId}. This uses a look credit.`,
  };
}

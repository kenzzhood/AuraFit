import { OutfitCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyzeFashionImage } from "@/lib/azure/vision";
import {
  classifyGarment,
  describeGarment,
} from "@/lib/ai/garment-classifier";
import { embedText, upsertFashionEmbeddingRow } from "@/lib/ai/embeddings";
import { assertCanAddWardrobeItem } from "@/lib/billing/entitlements";
import { assertAllowedUserMediaUrl } from "@/lib/security/ssrf";
import { assertUserBlobPath } from "@/lib/security/blob-path";

export function blobPathFromMediaUrl(
  url: string,
  clerkUserId: string
): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("cloudinary.com")) {
      const marker = "/upload/";
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        let rest = u.pathname.slice(idx + marker.length);
        rest = rest.replace(/^v\d+\//, "");
        const segments = rest.split("/").filter((s) => s && !s.includes(","));
        const last = segments[segments.length - 1] ?? "";
        segments[segments.length - 1] = last.replace(/\.[a-z0-9]+$/i, "");
        const publicId = segments.join("/");
        if (publicId.includes(`aurafit/${clerkUserId}/`)) {
          return `cloudinary:${publicId}`;
        }
      }
    }
    const decoded = decodeURIComponent(u.pathname);
    const match = decoded.match(/aurafit\/[^/]+\/[^?]+/);
    if (match && match[0].includes(`aurafit/${clerkUserId}/`)) {
      return match[0].replace(/^\//, "").replace(/\.[a-z0-9]+$/i, "");
    }
  } catch {
    /* fall through */
  }
  return `aurafit/${clerkUserId}/chat/${Date.now()}`;
}

export async function createWardrobeItemFromImage(params: {
  userId: string;
  imageUrl: string;
  category?: OutfitCategory;
}): Promise<{
  id: string;
  category: OutfitCategory;
  description?: string;
}> {
  await assertCanAddWardrobeItem(params.userId);
  assertAllowedUserMediaUrl(params.imageUrl);

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { clerkId: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  const blobPath = blobPathFromMediaUrl(params.imageUrl, user.clerkId);
  try {
    assertUserBlobPath(blobPath, user.clerkId);
  } catch {
    // Synthetic chat paths still belong to this Clerk user.
    if (!blobPath.startsWith(`aurafit/${user.clerkId}/`)) {
      throw new Error("Image is not a user upload");
    }
  }

  let wardrobe = await prisma.wardrobe.findFirst({
    where: { userId: params.userId },
  });
  if (!wardrobe) {
    wardrobe = await prisma.wardrobe.create({
      data: { userId: params.userId, name: "Main" },
    });
  }

  let tags: string[] = [];
  let caption: string | undefined;
  let description: string | undefined;
  let resolvedCategory: OutfitCategory =
    params.category ?? OutfitCategory.OTHER;

  const [vision, classified, described] = await Promise.all([
    analyzeFashionImage(params.imageUrl).catch((e) => {
      console.warn("analyzeFashionImage failed:", e);
      return { tags: [] as string[], caption: undefined };
    }),
    params.category
      ? Promise.resolve(params.category)
      : classifyGarment(params.imageUrl),
    describeGarment(params.imageUrl),
  ]);
  tags = vision.tags;
  caption = vision.caption;
  description = described || undefined;
  resolvedCategory = classified;

  const styleLabels =
    caption || description
      ? {
          ...(caption ? { caption } : {}),
          ...(description ? { description } : {}),
        }
      : undefined;

  const item = await prisma.wardrobeItem.create({
    data: {
      wardrobeId: wardrobe.id,
      blobPath,
      imageUrl: params.imageUrl,
      category: resolvedCategory,
      tags: tags.length ? tags : undefined,
      styleLabels,
    },
  });

  if (caption || tags.length) {
    try {
      const text = [caption, ...tags].filter(Boolean).join(". ");
      const vec = await embedText(text);
      await upsertFashionEmbeddingRow(item.id, vec);
    } catch (e) {
      console.warn("Embedding skipped:", e);
    }
  }

  return {
    id: item.id,
    category: resolvedCategory,
    description,
  };
}

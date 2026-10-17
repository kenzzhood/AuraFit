import { prisma } from "@/lib/prisma";
import {
  assertAllowedUserMediaUrl,
  isAllowedUserMediaUrl,
} from "@/lib/security/ssrf";

export function firstAllowedImageUrl(
  urls: string[] | undefined
): string | undefined {
  if (!urls?.length) return undefined;
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    try {
      assertAllowedUserMediaUrl(raw);
      return raw;
    } catch {
      continue;
    }
  }
  return undefined;
}

function urlsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const urls = (metadata as { imageUrls?: unknown }).imageUrls;
  if (!Array.isArray(urls)) return [];
  return urls.filter((u): u is string => typeof u === "string");
}

/**
 * Prefer the latest attached chat photo, then conversation history, then a
 * profile or wardrobe selfie. All URLs must pass the user-media allowlist.
 */
export async function resolveUserPhotoUrl(params: {
  userId: string;
  conversationId: string;
  imageUrls?: string[];
  excludeUrls?: string[];
}): Promise<string | null> {
  const skip = new Set(params.excludeUrls ?? []);
  const attached = firstAllowedImageUrl(
    params.imageUrls?.filter((u) => !skip.has(u))
  );
  if (attached) return attached;

  const messages = await prisma.message.findMany({
    where: { conversationId: params.conversationId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { metadata: true },
  });
  for (const row of messages) {
    const found = firstAllowedImageUrl(
      urlsFromMetadata(row.metadata).filter((u) => !skip.has(u))
    );
    if (found) return found;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { profileImageUrl: true },
  });
  if (user?.profileImageUrl && isAllowedUserMediaUrl(user.profileImageUrl)) {
    return user.profileImageUrl;
  }

  const item = await prisma.wardrobeItem.findFirst({
    where: {
      wardrobe: { userId: params.userId },
      imageUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { imageUrl: true },
  });
  if (item?.imageUrl && isAllowedUserMediaUrl(item.imageUrl)) {
    return item.imageUrl;
  }

  return null;
}

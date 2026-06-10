import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";
import { OutfitCategory } from "@prisma/client";
import { analyzeFashionImage } from "@/lib/azure/vision";
import {
  classifyGarment,
  describeGarment,
} from "@/lib/ai/garment-classifier";
import { embedText, upsertFashionEmbeddingRow } from "@/lib/ai/embeddings";

const postSchema = z.object({
  blobPath: z.string(),
  category: z.nativeEnum(OutfitCategory).optional(),
  imageUrl: z.string().optional(),
});

import { resolveWardrobeItemReadUrl } from "@/lib/storage/item-read-url";
import { rateLimit, WARDROBE_WRITE_RATE_LIMIT } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";
import { assertUserBlobPath } from "@/lib/security/blob-path";
import {
  assertAllowedUserMediaUrl,
  UnsafeUrlError,
} from "@/lib/security/ssrf";

const container =
  process.env.AZURE_STORAGE_CONTAINER_WARDROBES ?? "wardrobes";

function attachReadUrls<T extends { blobPath: string; imageUrl: string | null }>(
  items: T[]
) {
  return items.map((item) => ({
    ...item,
    readUrl: resolveWardrobeItemReadUrl(item, container),
  }));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const data = await prisma.wardrobe.findMany({
    where: { userId: user.id },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });

  const enriched = data.map((w) => ({
    ...w,
    items: attachReadUrls(w.items),
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const lim = await rateLimit(
    `wardrobe:${user.id}`,
    WARDROBE_WRITE_RATE_LIMIT.limit,
    WARDROBE_WRITE_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("wardrobe", lim.retryAfterSec);
  }

  const body = postSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  let wardrobe = await prisma.wardrobe.findFirst({ where: { userId: user.id } });
  if (!wardrobe) {
    wardrobe = await prisma.wardrobe.create({
      data: { userId: user.id, name: "Main" },
    });
  }

  const { blobPath, category, imageUrl } = body.data;

  try {
    assertUserBlobPath(blobPath, userId);
    if (imageUrl) {
      assertAllowedUserMediaUrl(imageUrl);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid upload reference";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // When the client sent an explicit category we trust it (manual override
  // path). Otherwise we ask GPT-4o vision to classify the garment AND write
  // a short catalogue description, in parallel with the Azure Vision tag
  // call so the upload still resolves in roughly one round-trip.
  let tags: string[] = [];
  let caption: string | undefined;
  let description: string | undefined;
  let resolvedCategory: OutfitCategory = category ?? OutfitCategory.OTHER;

  if (imageUrl) {
    const [vision, classified, described] = await Promise.all([
      analyzeFashionImage(imageUrl).catch((e) => {
        console.warn("analyzeFashionImage failed:", e);
        return { tags: [] as string[], caption: undefined };
      }),
      category
        ? Promise.resolve<OutfitCategory>(category)
        : classifyGarment(imageUrl),
      describeGarment(imageUrl),
    ]);
    tags = vision.tags;
    caption = vision.caption;
    description = described || undefined;
    resolvedCategory = classified;
  }

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
      imageUrl: imageUrl ?? null,
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

  return NextResponse.json(item);
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";
import { PostVisibility } from "@prisma/client";
import { rateLimit } from "@/lib/redis";
import { sanitizePostForPublic } from "@/lib/api/sanitize-public";

const createSchema = z.object({
  outfitId: z.string(),
  caption: z.string().max(2000).optional(),
  visibility: z.nativeEnum(PostVisibility),
  lookNumber: z.number().int().min(1).max(12).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const take = Math.min(30, Math.max(1, Number(searchParams.get("take") ?? "12")));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const skip = (page - 1) * take;

  const where = {
    visibility: PostVisibility.PUBLIC,
    publishedAt: { not: null },
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
        outfit: {
          include: {
            generatedImages: { take: 1, orderBy: { createdAt: "desc" } },
            items: { include: { productCache: true } },
          },
        },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return NextResponse.json({
    posts: posts.map((post) => sanitizePostForPublic(post)),
    page,
    totalPages: Math.ceil(total / take) || 1,
    hasMore: skip + posts.length < total,
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  if (user.deletedAt) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  const lim = await rateLimit(`posts:${user.id}`, 60, 60);
  if (!lim.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outfit = await prisma.outfit.findFirst({
    where: { id: parsed.data.outfitId, userId: user.id },
  });
  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }

  if (!user.username && parsed.data.visibility === PostVisibility.PUBLIC) {
    return NextResponse.json(
      { error: "Set a username before publishing publicly" },
      { status: 400 }
    );
  }

  const post = await prisma.post.create({
    data: {
      userId: user.id,
      outfitId: outfit.id,
      caption: parsed.data.caption,
      visibility: parsed.data.visibility,
      lookNumber: parsed.data.lookNumber,
      tags: parsed.data.tags ?? undefined,
      publishedAt:
        parsed.data.visibility === PostVisibility.PUBLIC ? new Date() : null,
    },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, profileImageUrl: true },
      },
      outfit: { include: { generatedImages: true, items: { include: { productCache: true } } } },
    },
  });

  return NextResponse.json(post);
}

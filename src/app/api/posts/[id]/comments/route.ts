import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";
import { rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

const createSchema = z.object({
  content: z.string().min(1).max(2000),
});

async function canReadPostComments(
  postId: string,
  viewerAppUserId?: string
): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      visibility: true,
      publishedAt: true,
      userId: true,
    },
  });
  if (!post) return false;
  if (post.visibility === "PUBLIC" && post.publishedAt) return true;
  if (viewerAppUserId && post.userId === viewerAppUserId) return true;
  return false;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { userId } = await auth();
  let viewerId: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, deletedAt: true },
    });
    if (user && !user.deletedAt) viewerId = user.id;
  }

  if (!(await canReadPostComments(postId, viewerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.postComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
        },
      },
    },
    take: 100,
  });
  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

  const lim = await rateLimit(`comments:${user.id}`, 30, 15 * 60);
  if (!lim.ok) {
    return rateLimitedResponse("comments", lim.retryAfterSec);
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post?.publishedAt || post.visibility !== "PUBLIC") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await prisma.postComment.create({
    data: {
      userId: user.id,
      postId,
      content: parsed.data.content,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return NextResponse.json(comment);
}

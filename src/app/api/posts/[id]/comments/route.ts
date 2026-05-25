import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";

const createSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
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
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  if (user.deletedAt) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post?.publishedAt) {
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

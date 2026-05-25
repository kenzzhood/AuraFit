import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { PostVisibility } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  const cu = userId ? await currentUser() : null;
  const appUser = userId
    ? await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress)
    : null;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          bio: true,
        },
      },
      outfit: {
        include: {
          generatedImages: true,
          items: { include: { productCache: true, wardrobeItem: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = appUser?.id === post.userId;
  const isPublic =
    post.visibility === PostVisibility.PUBLIC && post.publishedAt !== null;

  if (!isPublic && !isOwner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let likedByMe = false;
  if (appUser) {
    const like = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId: appUser.id, postId: id },
      },
    });
    likedByMe = !!like;
  }

  return NextResponse.json({
    post,
    likedByMe,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
  });
}

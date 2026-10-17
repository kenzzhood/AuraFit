import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeletedUserError, ensureAppUser } from "@/lib/user";
import { sanitizePostForPublic } from "@/lib/api/sanitize-public";
import { PostVisibility } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();

  const { userId } = await auth();
  const cu = userId ? await currentUser() : null;
  let viewer: Awaited<ReturnType<typeof ensureAppUser>> | null = null;
  if (userId) {
    try {
      viewer = await ensureAppUser(
        userId,
        cu?.primaryEmailAddress?.emailAddress
      );
    } catch (e) {
      if (e instanceof DeletedUserError) {
        return NextResponse.json(
          { error: "Account has been deleted" },
          { status: 403 }
        );
      }
      throw e;
    }
  }

  const profile = await prisma.user.findFirst({
    where: { username: decoded, deletedAt: null },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      isPublic: true,
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!profile.isPublic && profile.id !== viewer?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let isFollowing = false;
  if (viewer && viewer.id !== profile.id) {
    const f = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewer.id,
          followingId: profile.id,
        },
      },
    });
    isFollowing = !!f;
  }

  const posts = await prisma.post.findMany({
    where: {
      userId: profile.id,
      visibility: PostVisibility.PUBLIC,
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: 48,
    include: {
        outfit: {
          include: {
            generatedImages: { take: 1, orderBy: { createdAt: "desc" } },
            items: { include: { productCache: true } },
          },
        },
      _count: { select: { likes: true, comments: true } },
    },
  });

  return NextResponse.json({
    profile,
    followerCount: profile._count.followers,
    followingCount: profile._count.following,
    isFollowing,
    posts: posts.map((post) => sanitizePostForPublic(post)),
    isOwnProfile: viewer?.id === profile.id,
  });
}

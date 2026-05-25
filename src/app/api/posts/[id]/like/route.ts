import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";

export async function POST(
  _req: Request,
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

  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post?.publishedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.postLike.upsert({
    where: {
      userId_postId: { userId: user.id, postId },
    },
    create: { userId: user.id, postId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  try {
    await prisma.postLike.delete({
      where: {
        userId_postId: { userId: user.id, postId },
      },
    });
  } catch {
    /* not liked */
  }

  return NextResponse.json({ ok: true });
}

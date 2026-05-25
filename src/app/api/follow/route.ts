import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/),
});

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

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { username: parsed.data.username, deletedAt: null },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: target.id,
      },
    },
    create: {
      followerId: user.id,
      followingId: target.id,
    },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { username: parsed.data.username, deletedAt: null },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId: target.id,
        },
      },
    });
  } catch {
    /* not following */
  }

  return NextResponse.json({ ok: true });
}

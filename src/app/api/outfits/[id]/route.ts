import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().optional(),
  occasion: z.string().optional(),
  isSaved: z.boolean().optional(),
  snapshot: z.record(z.any()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  const { id } = await params;

  const outfit = await prisma.outfit.findFirst({
    where: { id, userId: user.id },
    include: { items: true, generatedImages: true },
  });
  if (!outfit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(outfit);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  const { id } = await params;

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.outfit.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const outfit = await prisma.outfit.update({
    where: { id },
    data: {
      name: body.data.name,
      occasion: body.data.occasion,
      isSaved: body.data.isSaved,
      snapshot: body.data.snapshot,
    },
  });
  return NextResponse.json(outfit);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  const { id } = await params;

  const existing = await prisma.outfit.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Hard delete. Prisma cascades remove OutfitItem, GeneratedImage, and Post
  // (and via Post, PostLike / PostComment). AffiliateClick keeps history via
  // SetNull so analytics aren't lost.
  await prisma.outfit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";
import { OutfitCategory } from "@prisma/client";

const patchSchema = z.object({
  category: z.nativeEnum(OutfitCategory).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).max(24).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const item = await prisma.wardrobeItem.findFirst({
    where: { id, wardrobe: { userId: user.id } },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.wardrobeItem.update({
    where: { id },
    data: {
      ...body.data,
      ...(body.data.tags !== undefined ? { tags: body.data.tags } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  const { id } = await params;
  const item = await prisma.wardrobeItem.findFirst({
    where: { id, wardrobe: { userId: user.id } },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.wardrobeItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

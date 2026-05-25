import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().optional(),
  occasion: z.string().optional(),
  isSaved: z.boolean().optional(),
  snapshot: z.record(z.any()).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const outfits = await prisma.outfit.findMany({
    where: { userId: user.id, isSaved: true },
    orderBy: { createdAt: "desc" },
    include: { items: true, generatedImages: true },
  });
  return NextResponse.json(outfits);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const outfit = await prisma.outfit.create({
    data: {
      userId: user.id,
      name: body.data.name,
      occasion: body.data.occasion,
      isSaved: body.data.isSaved ?? true,
      snapshot: body.data.snapshot,
    },
  });
  return NextResponse.json(outfit);
}

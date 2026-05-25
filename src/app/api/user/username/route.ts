import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";

const patchSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscore"),
  bio: z.string().max(280).optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: {
      username: parsed.data.username,
      NOT: { id: user.id },
    },
  });
  if (taken) {
    return NextResponse.json({ error: "Username taken" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      username: parsed.data.username,
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
    },
    select: { id: true, username: true, bio: true },
  });

  return NextResponse.json(updated);
}

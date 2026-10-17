import { auth, clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GDPR-style account deactivation.
 * Soft-deletes app data, clears PII fields, and deletes the Clerk user.
 * Media blob purge should be completed by a scheduled job using deletedAt.
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.deletedAt) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      email: null,
      username: null,
      bio: null,
      profileImageUrl: null,
      displayName: null,
      measurements: Prisma.DbNull,
      bodyAnalysis: Prisma.DbNull,
    },
  });

  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (e) {
    console.warn("[user] Clerk deleteUser failed — sessions may remain:", e);
  }

  return NextResponse.json({ ok: true });
}

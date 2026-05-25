import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";

/** GDPR-style soft delete — purge blobs in a background job in production. */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      email: null,
      username: null,
      bio: null,
      profileImageUrl: null,
    },
  });

  return NextResponse.json({ ok: true });
}

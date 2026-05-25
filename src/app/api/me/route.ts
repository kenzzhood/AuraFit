import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      onboardingStatus: true,
      email: true,
    },
  });

  return NextResponse.json({ user: full });
}

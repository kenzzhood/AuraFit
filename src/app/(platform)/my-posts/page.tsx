import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function MyPostsRedirectPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const u = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!u?.username) {
    redirect("/onboarding?reason=username");
  }
  redirect(`/profile/${u.username}`);
}

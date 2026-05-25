import { prisma } from "@/lib/prisma";

export async function ensureAppUser(clerkId: string, email?: string | null) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      clerkId,
      email: email ?? undefined,
    },
  });
}

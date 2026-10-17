import { prisma } from "@/lib/prisma";

export class DeletedUserError extends Error {
  constructor() {
    super("Account has been deleted");
    this.name = "DeletedUserError";
  }
}

export async function ensureAppUser(clerkId: string, email?: string | null) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) {
    if (existing.deletedAt) {
      throw new DeletedUserError();
    }
    return existing;
  }
  return prisma.user.create({
    data: {
      clerkId,
      email: email ?? undefined,
    },
  });
}

/** Soft-find for public read paths — does not create users. */
export async function findActiveAppUser(clerkId: string) {
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.deletedAt) return null;
  return user;
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { z } from "zod";
import { OnboardingStatus } from "@prisma/client";

const bodySchema = z.object({
  profileImageUrl: z.string().optional(),
  profileBlobPath: z.string().optional(),
  bodyAnalysis: z.record(z.any()).optional(),
  measurements: z.record(z.any()).optional(),
  stylePreference: z
    .object({
      aesthetics: z.unknown().optional(),
      colors: z.unknown().optional(),
      brands: z.unknown().optional(),
      occasions: z.unknown().optional(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      region: z.string().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  markComplete: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const b = parsed.data;

  if (b.profileImageUrl) {
    await prisma.user.update({
      where: { id: user.id },
      data: { profileImageUrl: b.profileImageUrl },
    });
  }

  if (b.bodyAnalysis !== undefined || b.measurements !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(b.bodyAnalysis !== undefined ? { bodyAnalysis: b.bodyAnalysis } : {}),
        ...(b.measurements !== undefined ? { measurements: b.measurements } : {}),
      },
    });
  }

  if (b.stylePreference) {
    await prisma.stylePreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aesthetics: b.stylePreference.aesthetics as object | undefined,
        colors: b.stylePreference.colors as object | undefined,
        brands: b.stylePreference.brands as object | undefined,
        occasions: b.stylePreference.occasions as object | undefined,
        budgetMin: b.stylePreference.budgetMin,
        budgetMax: b.stylePreference.budgetMax,
        region: b.stylePreference.region,
        currency: b.stylePreference.currency ?? "INR",
      },
      update: {
        aesthetics: b.stylePreference.aesthetics as object | undefined,
        colors: b.stylePreference.colors as object | undefined,
        brands: b.stylePreference.brands as object | undefined,
        occasions: b.stylePreference.occasions as object | undefined,
        budgetMin: b.stylePreference.budgetMin,
        budgetMax: b.stylePreference.budgetMax,
        region: b.stylePreference.region,
        currency: b.stylePreference.currency,
      },
    });
  }

  if (b.markComplete) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStatus: OnboardingStatus.COMPLETED },
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: { stylePreference: true },
  });

  return NextResponse.json({ user: updated });
}

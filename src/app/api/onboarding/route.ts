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
    try {
      const { assertAllowedUserMediaUrl } = await import("@/lib/security/ssrf");
      assertAllowedUserMediaUrl(b.profileImageUrl);
    } catch {
      return NextResponse.json(
        { error: "profileImageUrl must be an Aurafit media URL" },
        { status: 400 }
      );
    }
    if (b.profileBlobPath) {
      try {
        const { assertUserBlobPath } = await import("@/lib/security/blob-path");
        assertUserBlobPath(b.profileBlobPath, userId);
      } catch {
        return NextResponse.json(
          { error: "Invalid profileBlobPath" },
          { status: 400 }
        );
      }
    }
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
    select: {
      id: true,
      username: true,
      displayName: true,
      onboardingStatus: true,
      stylePreference: {
        select: {
          aesthetics: true,
          colors: true,
          brands: true,
          occasions: true,
          budgetMin: true,
          budgetMax: true,
          region: true,
          currency: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: updated
      ? {
          id: updated.id,
          username: updated.username,
          displayName: updated.displayName,
          onboardingCompleted:
            updated.onboardingStatus === OnboardingStatus.COMPLETED,
          onboardingStatus: updated.onboardingStatus,
          stylePreference: updated.stylePreference,
        }
      : null,
  });
}

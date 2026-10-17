import { auth, currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DeletedUserError, ensureAppUser } from "@/lib/user";
import { generateJobSchema } from "@/types/api";
import { JobStatus, JobType } from "@prisma/client";
import { tryRemoteEnqueueGeneration } from "@/lib/queue/producer";
import { processGenerationJob } from "@/lib/jobs/generation";
import { generationRateLimitedResponse } from "@/lib/api/rate-limit-response";
import { GENERATION_RATE_LIMIT, rateLimit } from "@/lib/redis";
import {
  assertAllowedUserMediaUrl,
  UnsafeUrlError,
} from "@/lib/security/ssrf";
import {
  EntitlementError,
  assertCanGenerate,
} from "@/lib/billing/entitlements";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let user;
  try {
    const cu = await currentUser();
    user = await ensureAppUser(
      userId,
      cu?.primaryEmailAddress?.emailAddress
    );
  } catch (e) {
    if (e instanceof DeletedUserError) {
      return NextResponse.json(
        { error: "Account has been deleted" },
        { status: 403 }
      );
    }
    throw e;
  }

  const lim = await rateLimit(
    `gen:${user.id}`,
    GENERATION_RATE_LIMIT.limit,
    GENERATION_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return generationRateLimitedResponse(lim.retryAfterSec);
  }

  const parsed = generateJobSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.userPhotoUrl) {
    try {
      assertAllowedUserMediaUrl(parsed.data.userPhotoUrl);
    } catch (e) {
      const msg =
        e instanceof UnsafeUrlError
          ? "userPhotoUrl must be an uploaded image from Aurafit storage"
          : "Invalid userPhotoUrl";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const isPreviewOnly =
    parsed.data.previewOnly === true ||
    parsed.data.renderQuality === "preview";

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanGenerate(user.id, {
      previewOnly: isPreviewOnly,
    });
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 402 }
      );
    }
    throw e;
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      jobType: JobType.GENERATION,
      status: JobStatus.QUEUED,
      payload: {
        ...(parsed.data as object),
        billingReservationId: reservationId,
      },
    },
  });

  if (reservationId) {
    await prisma.usageReservation
      .update({
        where: { id: reservationId },
        data: { jobId: job.id },
      })
      .catch(() => undefined);
  }

  const payload = {
    jobId: job.id,
    userId: user.id,
    type: "GENERATION",
    input: parsed.data as Record<string, unknown>,
  };

  const remote = await tryRemoteEnqueueGeneration(payload);
  if (!remote) {
    after(async () => {
      try {
        await processGenerationJob(payload);
      } catch (e) {
        console.error("Deferred generation failed:", e);
        await prisma.generationJob
          .update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              error: e instanceof Error ? e.message : "Generation failed",
            },
          })
          .catch(() => undefined);
        if (reservationId) {
          const { finalizeUsage } = await import("@/lib/billing/entitlements");
          await finalizeUsage(reservationId, false, job.id).catch(() => undefined);
        }
      }
    });
  }

  return NextResponse.json({ jobId: job.id });
}

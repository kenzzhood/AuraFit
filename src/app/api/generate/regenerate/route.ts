import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateJobSchema } from "@/types/api";
import { JobStatus, JobType } from "@prisma/client";
import { tryRemoteEnqueueGeneration } from "@/lib/queue/producer";
import { processGenerationJob } from "@/lib/jobs/generation";
import { generationRateLimitedResponse } from "@/lib/api/rate-limit-response";
import { GENERATION_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { withCors, optionsResponse } from "@/lib/api/cors";
import { requireAppUser } from "@/lib/api/require-user";
import {
  EntitlementError,
  assertCanGenerate,
} from "@/lib/billing/entitlements";

const schema = z.object({ jobId: z.string() });

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

/**
 * Regenerate-all: enqueue a fresh 6-look package reusing the parent job's
 * brief. Subject to the same billing entitlements as /api/generate.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const authz = await requireAppUser();
  if (!authz.ok) return withCors(authz.response, origin);
  const user = authz.user;

  const lim = await rateLimit(
    `gen:${user.id}`,
    GENERATION_RATE_LIMIT.limit,
    GENERATION_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return withCors(
      generationRateLimitedResponse(lim.retryAfterSec),
      origin
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  const parent = await prisma.generationJob.findFirst({
    where: { id: parsed.data.jobId, userId: user.id },
  });
  if (!parent?.payload) {
    return withCors(
      NextResponse.json({ error: "Parent job not found" }, { status: 404 }),
      origin
    );
  }

  const briefParsed = generateJobSchema.safeParse(parent.payload);
  if (!briefParsed.success) {
    return withCors(
      NextResponse.json(
        { error: "Parent job payload is not a valid generation brief" },
        { status: 400 }
      ),
      origin
    );
  }

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanGenerate(user.id);
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return withCors(
        NextResponse.json({ error: e.message, code: e.code }, { status: 402 }),
        origin
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
        ...(briefParsed.data as object),
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
    type: "GENERATION" as const,
    input: briefParsed.data as Record<string, unknown>,
  };

  const remote = await tryRemoteEnqueueGeneration(payload);
  if (!remote) {
    after(async () => {
      try {
        await processGenerationJob(payload);
      } catch (e) {
        console.error("Deferred regeneration failed:", e);
        await prisma.generationJob
          .update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              error: e instanceof Error ? e.message : "Regeneration failed",
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

  return withCors(NextResponse.json({ jobId: job.id }), origin);
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { generateJobSchema } from "@/types/api";
import { JobStatus, JobType } from "@prisma/client";
import { tryRemoteEnqueueGeneration } from "@/lib/queue/producer";
import { processGenerationJob } from "@/lib/jobs/generation";
import { generationRateLimitedResponse } from "@/lib/api/rate-limit-response";
import { GENERATION_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { withCors, optionsResponse } from "@/lib/api/cors";

const schema = z.object({ jobId: z.string() });

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

/**
 * Regenerate-all: enqueue a fresh 6-look package reusing the parent job's
 * brief. The discovery cache short-circuits repeat product queries, so a
 * regenerate is fast and cheap while still producing new looks.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { userId } = await auth();
  if (!userId) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      origin
    );
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

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

  // The parent payload may carry runtime flags (cancelled, type); re-validate
  // through the canonical schema so we only re-run a clean generation brief.
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

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      jobType: JobType.GENERATION,
      status: JobStatus.QUEUED,
      payload: briefParsed.data as object,
    },
  });

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
      }
    });
  }

  return withCors(NextResponse.json({ jobId: job.id }), origin);
}

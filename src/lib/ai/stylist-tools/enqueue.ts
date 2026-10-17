import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateJobSchema } from "@/types/api";
import { tryRemoteEnqueueGeneration } from "@/lib/queue/producer";
import { processGenerationJob } from "@/lib/jobs/generation";
import { finalizeUsage } from "@/lib/billing/entitlements";
import type { z } from "zod";

export type ChatGenerationInput = z.infer<typeof generateJobSchema>;

export async function enqueueChatGenerationJob(params: {
  userId: string;
  input: ChatGenerationInput;
  reservationId: string | null;
}): Promise<string> {
  const input = generateJobSchema.parse(params.input);
  const job = await prisma.generationJob.create({
    data: {
      userId: params.userId,
      jobType: JobType.GENERATION,
      status: JobStatus.QUEUED,
      payload: {
        ...(input as object),
        billingReservationId: params.reservationId,
      },
    },
  });

  if (params.reservationId) {
    await prisma.usageReservation
      .update({
        where: { id: params.reservationId },
        data: { jobId: job.id },
      })
      .catch(() => undefined);
  }

  const payload = {
    jobId: job.id,
    userId: params.userId,
    type: "GENERATION" as const,
    input: input as Record<string, unknown>,
  };

  const remote = await tryRemoteEnqueueGeneration(payload);
  if (!remote) {
    // Chat NDJSON ends as soon as tools return { jobId }. Next.js after() is
    // bound to that response and can drop the deferred work. setImmediate
    // keeps processGenerationJob running after the stream closes.
    setImmediate(() => {
      void processGenerationJob(payload).catch(async (e) => {
        console.error("Deferred chat generation failed:", e);
        await prisma.generationJob
          .update({
            where: { id: job.id },
            data: {
              status: JobStatus.FAILED,
              error: e instanceof Error ? e.message : "Generation failed",
            },
          })
          .catch(() => undefined);
        if (params.reservationId) {
          await finalizeUsage(params.reservationId, false, job.id).catch(
            () => undefined
          );
        }
      });
    });
  }

  return job.id;
}

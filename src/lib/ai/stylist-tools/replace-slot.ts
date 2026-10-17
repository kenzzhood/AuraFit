import { after } from "next/server";
import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EntitlementError,
  assertCanGenerate,
} from "@/lib/billing/entitlements";
import { processChatRerender } from "@/lib/jobs/chat-rerender";
import type { StylistToolContext, StylistToolResult } from "./types";

export async function handleReplaceSlot(
  ctx: StylistToolContext,
  args: Record<string, unknown>
): Promise<StylistToolResult> {
  const jobId = typeof args.jobId === "string" ? args.jobId : "";
  const lookIndex =
    typeof args.lookIndex === "number" ? Math.trunc(args.lookIndex) : -1;
  const category = typeof args.category === "string" ? args.category : "";
  const instruction =
    typeof args.instruction === "string" ? args.instruction : undefined;

  if (!jobId || lookIndex < 0 || !category) {
    return {
      ok: false,
      message: "replace_slot requires jobId, lookIndex, and category.",
    };
  }

  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId: ctx.userId, jobType: JobType.GENERATION },
  });
  if (!job) {
    return { ok: false, message: "Look job not found for this user." };
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  if (payload.source !== "chat") {
    return {
      ok: false,
      message: "That look was not generated in chat. Call generate_looks instead.",
    };
  }
  if (
    typeof payload.conversationId === "string" &&
    payload.conversationId !== ctx.conversationId
  ) {
    return { ok: false, message: "That look belongs to a different conversation." };
  }
  if (job.status === JobStatus.PROCESSING || job.status === JobStatus.QUEUED) {
    return {
      ok: false,
      message: "That look is still rendering. Wait until it finishes before swapping a slot.",
    };
  }
  if (!job.result) {
    return { ok: false, message: "That look has no result to update yet." };
  }

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanGenerate(ctx.userId);
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return {
        ok: false,
        error: e.message,
        code: e.code,
        message: e.message,
      };
    }
    throw e;
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: JobStatus.PROCESSING,
      progress: 8,
      error: null,
      payload: {
        ...payload,
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

  after(async () => {
    try {
      await processChatRerender({
        userId: ctx.userId,
        jobId: job.id,
        lookIndex,
        category,
        instruction,
      });
    } catch (e) {
      console.error("Chat rerender failed:", e);
      await prisma.generationJob
        .update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            error: e instanceof Error ? e.message : "Slot swap failed",
          },
        })
        .catch(() => undefined);
      if (reservationId) {
        const { finalizeUsage } = await import("@/lib/billing/entitlements");
        await finalizeUsage(reservationId, false, job.id).catch(() => undefined);
      }
    }
  });

  return {
    ok: true,
    jobId: job.id,
    status: "queued",
    message: `Re-rendering look ${lookIndex + 1} after swapping ${category} (job ${job.id}). This uses a look credit. Poll the same job — a new boardImageUrl will appear when done.`,
  };
}

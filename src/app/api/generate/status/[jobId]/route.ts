import { auth } from "@clerk/nextjs/server";
import { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// If a job sits in PROCESSING/QUEUED with no progress updates for this long,
// the worker process is almost certainly dead (dev server restart, crash,
// inline `after()` killed mid-run). We auto-fail it here so the polling UI
// can move on instead of spinning forever on a zombie row.
//
// Sync product crawl + recovery can run several minutes; keep above the
// product-phase budget and mobile poll window so healthy jobs are not killed.
const STALE_JOB_THRESHOLD_MS = 12 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId: user.id },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isInFlight =
    job.status === JobStatus.PROCESSING || job.status === JobStatus.QUEUED;
  const ageMs = Date.now() - job.updatedAt.getTime();
  if (isInFlight && ageMs > STALE_JOB_THRESHOLD_MS) {
    const failed = await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        error:
          "Generation timed out. The worker stopped responding — please start a new generation.",
      },
    });
    const payload = job.payload as { billingReservationId?: unknown } | null;
    if (typeof payload?.billingReservationId === "string") {
      const { finalizeUsage } = await import("@/lib/billing/entitlements");
      await finalizeUsage(payload.billingReservationId, false, job.id).catch(
        () => undefined
      );
    }
    return NextResponse.json(failed);
  }

  return NextResponse.json(job);
}

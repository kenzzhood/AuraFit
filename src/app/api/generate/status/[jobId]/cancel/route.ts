import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { withCors, optionsResponse } from "@/lib/api/cors";

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const origin = req.headers.get("origin");
  const { userId } = await auth();
  if (!userId) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      origin
    );
  }
  const { jobId } = await params;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return withCors(
      NextResponse.json({ error: "User not found" }, { status: 404 }),
      origin
    );
  }

  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId: user.id },
  });
  if (!job) {
    return withCors(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
      origin
    );
  }

  const payload =
    typeof job.payload === "object" && job.payload !== null
      ? { ...(job.payload as object), cancelled: true }
      : { cancelled: true };

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      payload,
      status:
        job.status === JobStatus.DONE || job.status === JobStatus.FAILED
          ? job.status
          : JobStatus.FAILED,
      error:
        job.status === JobStatus.DONE ? job.error : "Cancelled by user",
    },
  });

  const reservationId =
    typeof job.payload === "object" &&
    job.payload !== null &&
    "billingReservationId" in job.payload
      ? (job.payload as { billingReservationId?: string | null })
          .billingReservationId ?? null
      : null;

  if (
    reservationId &&
    (job.status === JobStatus.QUEUED || job.status === JobStatus.PROCESSING)
  ) {
    const { finalizeUsage } = await import("@/lib/billing/entitlements");
    await finalizeUsage(reservationId, false, job.id).catch(() => undefined);
  }

  return withCors(NextResponse.json({ ok: true }), origin);
}

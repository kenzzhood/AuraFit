import { auth, currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAppUser } from "@/lib/user";
import { generateJobSchema } from "@/types/api";
import { JobStatus, JobType } from "@prisma/client";
import { tryRemoteEnqueueGeneration } from "@/lib/queue/producer";
import { processGenerationJob } from "@/lib/jobs/generation";
import { rateLimit } from "@/lib/redis";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

  const lim = await rateLimit(`gen:${user.id}`, 10, 60);
  if (!lim.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const parsed = generateJobSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      jobType: JobType.GENERATION,
      status: JobStatus.QUEUED,
      payload: parsed.data as object,
    },
  });

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
      }
    });
  }

  return NextResponse.json({ jobId: job.id });
}

import { JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { GenerationJobResult } from "@/types/generation";
import type { StylistToolContext, StylistToolResult } from "./types";

function jobIdsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const ids = (metadata as { jobIds?: unknown }).jobIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function handleRecallLooks(
  ctx: StylistToolContext,
  _args: Record<string, unknown>
): Promise<StylistToolResult> {
  const jobs = await prisma.generationJob.findMany({
    where: { userId: ctx.userId, jobType: JobType.GENERATION },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  let job = jobs.find((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return (
      payload.source === "chat" && payload.conversationId === ctx.conversationId
    );
  });

  if (!job) {
    const messages = await prisma.message.findMany({
      where: { conversationId: ctx.conversationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { metadata: true },
    });
    const ids = messages.flatMap((m) => jobIdsFromMetadata(m.metadata));
    job = jobs.find((row) => ids.includes(row.id));
  }

  if (!job?.result) {
    return {
      ok: false,
      message:
        "No looks in this chat yet. Call generate_looks after the user shares a photo.",
    };
  }

  const result = job.result as GenerationJobResult;
  const looks = (result.looks ?? []).map((look, i) => ({
    lookIndex: i,
    label: look.label,
    tagline: look.tagline,
    description: look.description,
    products: (look.products ?? []).map((p) => ({
      title: p.title,
      matchCategory: p.matchCategory,
      productUrl: p.productUrl,
    })),
  }));

  return {
    ok: true,
    jobId: job.id,
    status: job.status === "DONE" ? "done" : "queued",
    boardImageUrl: result.boardImageUrl ?? undefined,
    lastLooks: result.looks,
    looks,
    message: `Latest chat looks job ${job.id} (${job.status}) with ${looks.length} look(s). Use replace_slot with this jobId and lookIndex 0–${Math.max(looks.length - 1, 0)}.`,
  };
}

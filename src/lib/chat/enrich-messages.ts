import { prisma } from "@/lib/prisma";
import type { GenerationLookResult } from "@/types/generation";

type MessageLike = {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
  createdAt: Date;
};

type MessageMetadata = {
  imageUrls?: string[];
  jobIds?: string[];
  lastLooks?: GenerationLookResult[];
  lastProducts?: unknown;
  boardImageUrl?: string | null;
  jobStatus?: string;
  jobError?: string | null;
  [key: string]: unknown;
};

function asMetadata(raw: unknown): MessageMetadata {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as MessageMetadata) };
  }
  return {};
}

function collectJobIds(messages: MessageLike[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    const meta = asMetadata(m.metadata);
    if (!Array.isArray(meta.jobIds)) continue;
    for (const id of meta.jobIds) {
      if (typeof id === "string" && id.length > 0) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Overlay GenerationJob result onto assistant message metadata so a hydrated
 * thread shows the board and live job status even if metadata is stale.
 */
export async function enrichChatMessages<T extends MessageLike>(
  messages: T[],
  userId: string
): Promise<T[]> {
  const jobIds = collectJobIds(messages);
  if (jobIds.length === 0) return messages;

  const jobs = await prisma.generationJob.findMany({
    where: { userId, id: { in: jobIds } },
    select: { id: true, status: true, error: true, result: true },
  });
  const byId = new Map(jobs.map((j) => [j.id, j]));

  return messages.map((m) => {
    const meta = asMetadata(m.metadata);
    const primaryId =
      Array.isArray(meta.jobIds) && typeof meta.jobIds[0] === "string"
        ? meta.jobIds[0]
        : undefined;
    const job = primaryId ? byId.get(primaryId) : undefined;
    if (!job) {
      return { ...m, metadata: Object.keys(meta).length ? meta : m.metadata };
    }

    const result = (job.result ?? null) as {
      boardImageUrl?: string | null;
      looks?: GenerationLookResult[];
    } | null;

    const next: MessageMetadata = {
      ...meta,
      jobStatus: job.status,
      jobError: job.error,
    };
    if (result && "boardImageUrl" in result) {
      next.boardImageUrl = result.boardImageUrl;
    }
    if (result?.looks?.length) {
      next.lastLooks = result.looks;
    }
    return { ...m, metadata: next };
  });
}

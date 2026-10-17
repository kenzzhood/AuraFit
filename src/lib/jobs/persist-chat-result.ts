import { prisma } from "@/lib/prisma";
import type { GenerationLookResult } from "@/types/generation";
import type { Prisma } from "@prisma/client";

function metadataObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function jobIdsFromMetadata(raw: unknown): string[] {
  const meta = metadataObject(raw);
  if (!Array.isArray(meta.jobIds)) return [];
  return meta.jobIds.filter((id): id is string => typeof id === "string");
}

export async function persistChatJobResultToMessages(params: {
  userId: string;
  conversationId?: string;
  source?: string;
  jobId: string;
  boardImageUrl: string | null;
  looks: GenerationLookResult[];
}): Promise<void> {
  if (params.source !== "chat" || !params.conversationId) return;

  const owned = await prisma.conversation.findFirst({
    where: { id: params.conversationId, userId: params.userId },
    select: { id: true },
  });
  if (!owned) return;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: params.conversationId,
      role: "assistant",
    },
  });

  const matches = messages.filter((m) =>
    jobIdsFromMetadata(m.metadata).includes(params.jobId)
  );

  for (const m of matches) {
    const meta = metadataObject(m.metadata);
    await prisma.message.update({
      where: { id: m.id },
      data: {
        metadata: {
          ...meta,
          lastLooks: params.looks,
          boardImageUrl: params.boardImageUrl,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

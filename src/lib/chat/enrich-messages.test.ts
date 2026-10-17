import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  generationJob: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { enrichChatMessages } from "./enrich-messages";

function msg(partial: {
  id?: string;
  role?: string;
  content?: string;
  metadata?: unknown;
}) {
  return {
    id: partial.id ?? "m1",
    role: partial.role ?? "assistant",
    content: partial.content ?? "here are looks",
    metadata: partial.metadata ?? {},
    createdAt: new Date("2026-08-20T10:00:00.000Z"),
  };
}

describe("enrichChatMessages", () => {
  beforeEach(() => {
    prismaMock.generationJob.findMany.mockReset();
  });

  it("returns messages unchanged when there are no jobIds", async () => {
    const messages = [msg({ metadata: { lastProducts: [] } })];
    const out = await enrichChatMessages(messages, "user-1");
    expect(prismaMock.generationJob.findMany).not.toHaveBeenCalled();
    expect(out).toEqual(messages);
  });

  it("does not mark done just because lastLooks exist while the job is processing", async () => {
    prismaMock.generationJob.findMany.mockResolvedValueOnce([
      {
        id: "job-1",
        status: "PROCESSING",
        error: null,
        result: { looks: [{ label: "Office", productSearchQuery: "navy" }] },
      },
    ]);
    const messages = [
      msg({
        metadata: {
          jobIds: ["job-1"],
          lastLooks: [{ label: "Office", productSearchQuery: "navy" }],
        },
      }),
    ];
    const out = await enrichChatMessages(messages, "user-1");
    const meta = out[0]!.metadata as {
      jobStatus?: string;
      lastLooks?: unknown[];
    };
    expect(meta.jobStatus).toBe("PROCESSING");
    expect(meta.jobStatus).not.toBe("DONE");
    expect(meta.jobStatus).not.toBe("done");
    expect(meta.lastLooks).toHaveLength(1);
  });

  it("overlays boardImageUrl and lastLooks from a DONE job when metadata is stale", async () => {
    prismaMock.generationJob.findMany.mockResolvedValueOnce([
      {
        id: "job-2",
        status: "DONE",
        error: null,
        result: {
          boardImageUrl: "https://res.cloudinary.com/demo/board.png",
          looks: [{ label: "Brunch", productSearchQuery: "linen" }],
        },
      },
    ]);
    const messages = [
      msg({
        metadata: {
          jobIds: ["job-2"],
          lastLooks: [{ label: "stale", productSearchQuery: "old" }],
        },
      }),
    ];
    const out = await enrichChatMessages(messages, "user-1");
    const meta = out[0]!.metadata as {
      jobStatus?: string;
      boardImageUrl?: string;
      lastLooks?: { label?: string }[];
    };
    expect(meta.jobStatus).toBe("DONE");
    expect(meta.boardImageUrl).toBe(
      "https://res.cloudinary.com/demo/board.png"
    );
    expect(meta.lastLooks?.[0]?.label).toBe("Brunch");
  });

  it("scopes GenerationJob lookup to the owning userId", async () => {
    prismaMock.generationJob.findMany.mockResolvedValueOnce([]);
    await enrichChatMessages(
      [msg({ metadata: { jobIds: ["job-9"] } })],
      "user-owned"
    );
    expect(prismaMock.generationJob.findMany).toHaveBeenCalledWith({
      where: { userId: "user-owned", id: { in: ["job-9"] } },
      select: { id: true, status: true, error: true, result: true },
    });
  });
});

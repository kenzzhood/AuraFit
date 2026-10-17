import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  message: { findMany: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { persistChatJobResultToMessages } from "./persist-chat-result";

const looks = [{ label: "Office", productSearchQuery: "navy shirt" }];

describe("persistChatJobResultToMessages", () => {
  beforeEach(() => {
    prismaMock.conversation.findFirst.mockReset();
    prismaMock.message.findMany.mockReset();
    prismaMock.message.update.mockReset();
  });

  it("returns without writing when source is not chat", async () => {
    await persistChatJobResultToMessages({
      userId: "u1",
      conversationId: "c1",
      source: "generate",
      jobId: "j1",
      boardImageUrl: "https://res.cloudinary.com/demo/b.png",
      looks,
    });
    expect(prismaMock.conversation.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.message.update).not.toHaveBeenCalled();
  });

  it("returns without writing when conversationId is missing", async () => {
    await persistChatJobResultToMessages({
      userId: "u1",
      source: "chat",
      jobId: "j1",
      boardImageUrl: null,
      looks,
    });
    expect(prismaMock.conversation.findFirst).not.toHaveBeenCalled();
  });

  it("merges lastLooks and boardImageUrl (including null) onto matching assistant messages", async () => {
    prismaMock.conversation.findFirst.mockResolvedValueOnce({ id: "c1" });
    prismaMock.message.findMany.mockResolvedValueOnce([
      {
        id: "m-match",
        metadata: { jobIds: ["j1"], lastProducts: [] },
      },
      {
        id: "m-other",
        metadata: { jobIds: ["other"] },
      },
    ]);
    prismaMock.message.update.mockResolvedValueOnce({});

    await persistChatJobResultToMessages({
      userId: "u1",
      conversationId: "c1",
      source: "chat",
      jobId: "j1",
      boardImageUrl: null,
      looks,
    });

    expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", userId: "u1" },
      select: { id: true },
    });
    expect(prismaMock.message.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.update).toHaveBeenCalledWith({
      where: { id: "m-match" },
      data: {
        metadata: {
          jobIds: ["j1"],
          lastProducts: [],
          lastLooks: looks,
          boardImageUrl: null,
        },
      },
    });
  });
});

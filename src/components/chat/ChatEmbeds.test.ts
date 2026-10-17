import { describe, expect, it } from "vitest";
import type { GenerationLookResult } from "@/types/generation";
import {
  looksEmbedFailureMessage,
  looksEmbedModel,
  mergeChatJobPoll,
} from "./ChatEmbeds";

describe("looksEmbedFailureMessage", () => {
  it("returns the trimmed job error when the look render failed", () => {
    expect(
      looksEmbedFailureMessage(
        "FAILED",
        "  We found products but could not load their photos for the board. Try again in a moment.  "
      )
    ).toBe(
      "We found products but could not load their photos for the board. Try again in a moment."
    );
    expect(looksEmbedFailureMessage("failed", "Photos unavailable")).toBe(
      "Photos unavailable"
    );
  });

  it("falls back to a generic message when the failed job has no error", () => {
    expect(looksEmbedFailureMessage("FAILED", null)).toBe(
      "Look render failed. Try again in chat."
    );
    expect(looksEmbedFailureMessage("FAILED", "   ")).toBe(
      "Look render failed. Try again in chat."
    );
    expect(looksEmbedFailureMessage("failed")).toBe(
      "Look render failed. Try again in chat."
    );
  });

  it("returns null when the job has not failed", () => {
    expect(looksEmbedFailureMessage("DONE", "ignored")).toBeNull();
    expect(looksEmbedFailureMessage("queued", null)).toBeNull();
  });
});

describe("looksEmbedModel", () => {
  it("keeps looks when FAILED and failMessage is set", () => {
    const looks: GenerationLookResult[] = [
      {
        label: "Office",
        productSearchQuery: "navy shirt",
        products: [
          {
            title: "Navy shirt",
            productUrl: "https://www.myntra.com/p/1",
          },
        ],
      },
    ];
    const model = looksEmbedModel({
      jobStatus: "FAILED",
      error: "Photos unavailable",
      looks,
    });
    expect(model.failMessage).toBe("Photos unavailable");
    expect(model.looks).toBe(looks);
    expect(model.looks).toHaveLength(1);
  });

  it("DONE without board still exposes looks", () => {
    const looks: GenerationLookResult[] = [
      {
        label: "Office",
        productSearchQuery: "navy shirt",
        products: [
          {
            title: "Navy shirt",
            productUrl: "https://www.myntra.com/p/1",
          },
        ],
      },
    ];
    const model = looksEmbedModel({
      jobStatus: "DONE",
      looks,
    });
    expect(model.failMessage).toBeNull();
    expect(model.looks).toHaveLength(1);
    expect(model.looks[0]?.label).toBe("Office");
  });
});

describe("mergeChatJobPoll", () => {
  it("passes FAILED error through and keeps nonempty result looks", () => {
    const looks: GenerationLookResult[] = [
      {
        label: "Office",
        productSearchQuery: "navy shirt",
        products: [
          {
            title: "Navy shirt",
            productUrl: "https://www.myntra.com/p/1",
          },
        ],
      },
    ];
    const prev = {
      jobStatus: "PROCESSING",
      jobError: undefined as string | null | undefined,
      boardImageUrl: undefined as string | undefined,
      looks: undefined as GenerationLookResult[] | undefined,
    };
    const merged = mergeChatJobPoll(prev, {
      status: "FAILED",
      error:
        "We found products but could not load their photos for the board. Try again in a moment.",
      result: { looks, boardImageUrl: null },
    });
    expect(merged.jobStatus).toBe("FAILED");
    expect(merged.jobError).toBe(
      "We found products but could not load their photos for the board. Try again in a moment."
    );
    expect(merged.looks).toBe(looks);
    expect(merged.looks).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  conversationPreviewFromUserText,
  conversationTitleFromUserText,
  mapConversationListItem,
} from "./conversations";

describe("conversationTitleFromUserText", () => {
  it("trims and collapses whitespace", () => {
    expect(conversationTitleFromUserText("  office   looks  ")).toBe(
      "office looks"
    );
  });

  it("caps length at 60 characters", () => {
    const long = "a".repeat(80);
    expect(conversationTitleFromUserText(long)).toBe("a".repeat(60));
    expect(conversationTitleFromUserText(long).length).toBe(60);
  });
});

describe("conversationPreviewFromUserText", () => {
  it("trims and collapses whitespace", () => {
    expect(conversationPreviewFromUserText("  navy  shirt ")).toBe("navy shirt");
  });

  it("truncates long previews", () => {
    const long = "word ".repeat(40).trim();
    const preview = conversationPreviewFromUserText(long);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(81);
  });
});

describe("mapConversationListItem", () => {
  it("uses stored title and first user message as preview", () => {
    const item = mapConversationListItem({
      id: "c1",
      title: "Weekend brunch",
      updatedAt: new Date("2026-08-20T10:00:00.000Z"),
      messages: [{ content: "  style me for brunch  " }],
    });
    expect(item).toEqual({
      id: "c1",
      title: "Weekend brunch",
      updatedAt: "2026-08-20T10:00:00.000Z",
      preview: "style me for brunch",
    });
  });

  it("falls back to the first user message for title", () => {
    const item = mapConversationListItem({
      id: "c2",
      title: null,
      updatedAt: new Date("2026-08-20T10:00:00.000Z"),
      messages: [{ content: "navy oxford and cream trousers" }],
    });
    expect(item.title).toBe("navy oxford and cream trousers");
    expect(item.preview).toBe("navy oxford and cream trousers");
  });
});

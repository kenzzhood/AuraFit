import { describe, expect, it } from "vitest";
import { generateJobSchema } from "@/types/api";
import { chatLooksJobFields } from "./generate-looks";

describe("chatLooksJobFields", () => {
  it("sets styleType from style and keeps occasion separate", () => {
    const fields = chatLooksJobFields({
      style: "old money",
      occasion: "wedding",
    });
    expect(fields.styleType).toBe("old money");
    expect(fields.style).toBe("old money");
    expect(fields.occasion).toBe("wedding");
  });

  it("prefers explicit styleType over style", () => {
    const fields = chatLooksJobFields({
      styleType: "office party",
      style: "navy",
    });
    expect(fields.styleType).toBe("office party");
    expect(fields.style).toBe("navy");
  });

  it("keeps lookCount at 2 or 3 and defaults to 3", () => {
    expect(chatLooksJobFields({}).lookCount).toBe(3);
    expect(chatLooksJobFields({ lookCount: 2 }).lookCount).toBe(2);
    expect(chatLooksJobFields({ lookCount: 3 }).lookCount).toBe(3);
    expect(chatLooksJobFields({ lookCount: 6 }).lookCount).toBe(3);
  });
});

describe("generateJobSchema lookCount", () => {
  it("still accepts 2, 3, and 6", () => {
    expect(
      generateJobSchema.safeParse({ path: "online", lookCount: 2 }).success
    ).toBe(true);
    expect(
      generateJobSchema.safeParse({ path: "online", lookCount: 3 }).success
    ).toBe(true);
    expect(
      generateJobSchema.safeParse({ path: "online", lookCount: 6 }).success
    ).toBe(true);
    expect(
      generateJobSchema.safeParse({ path: "online", lookCount: 4 }).success
    ).toBe(false);
  });
});

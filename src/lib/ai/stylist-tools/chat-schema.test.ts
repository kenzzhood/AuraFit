import { describe, expect, it } from "vitest";
import { chatMessageSchema } from "@/types/api";

describe("chatMessageSchema imageUrls", () => {
  it("accepts up to 4 https URLs", () => {
    const parsed = chatMessageSchema.safeParse({
      message: "hello",
      imageUrls: [
        "https://res.cloudinary.com/demo/image/upload/a.jpg",
        "https://res.cloudinary.com/demo/image/upload/b.jpg",
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects http imageUrls", () => {
    const parsed = chatMessageSchema.safeParse({
      message: "hello",
      imageUrls: ["http://res.cloudinary.com/demo/a.jpg"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 4 imageUrls", () => {
    const parsed = chatMessageSchema.safeParse({
      message: "hello",
      imageUrls: [
        "https://x.com/1.jpg",
        "https://x.com/2.jpg",
        "https://x.com/3.jpg",
        "https://x.com/4.jpg",
        "https://x.com/5.jpg",
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid URLs", () => {
    const parsed = chatMessageSchema.safeParse({
      message: "hello",
      imageUrls: ["not-a-url"],
    });
    expect(parsed.success).toBe(false);
  });
});

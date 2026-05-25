import OpenAI from "openai";
import type { FashionBoardImage, GenerateBoardInput, ImageProvider } from "./types";

function isConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export const openaiImageProvider: ImageProvider = {
  name: "openai",
  isConfigured,
  async generateBoard({ prompt }: GenerateBoardInput): Promise<FashionBoardImage> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const client = new OpenAI({ apiKey });
    const res = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
    });
    const first = res.data?.[0];
    if (first?.b64_json) {
      return { buffer: Buffer.from(first.b64_json, "base64") };
    }
    if (first?.url) return { url: first.url };
    throw new Error("OpenAI image generation failed");
  },
};

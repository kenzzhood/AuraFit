import OpenAI from "openai";
import type { PlannedLook, PersonAnalysis } from "@/types/generation";
import type {
  AIProvider,
  AnalyzePersonInput,
  ChatMessageInput,
  GenerateLooksInput,
} from "./types";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey });
}

export const openaiAIProvider: AIProvider = {
  name: "openai",

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  },

  async analyzePerson({ imageUrl }: AnalyzePersonInput) {
    const c = client();
    const completion = await c.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze person for fashion styling as JSON." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    return raw ? (JSON.parse(raw) as PersonAnalysis) : null;
  },

  async generateLooks(input: GenerateLooksInput) {
    const c = client();
    const completion = await c.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "system",
          content: 'Return JSON {"looks":[6 outfit plans]}',
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw
      ? (JSON.parse(raw) as { looks: PlannedLook[] }).looks
      : [];
    return parsed.slice(0, 6);
  },

  async *generateChat(messages: ChatMessageInput[]) {
    const c = client();
    const stream = await c.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  },

  async generateEmbeddings(text: string) {
    const c = client();
    const res = await c.embeddings.create({
      model: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-large",
      input: text,
    });
    return res.data[0]?.embedding ?? [];
  },
};

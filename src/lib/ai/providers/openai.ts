import OpenAI from "openai";
import type { PlannedLook, PersonAnalysis } from "@/types/generation";
import type {
  AIProvider,
  AnalyzePersonInput,
  ChatMessageInput,
  GenerateLooksInput,
  GenerateLooksResult,
} from "./types";
import { padLooksToCount, resolveLookCount } from "./azure";

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
    if (process.env.ALLOW_OPENAI_AI_FALLBACK !== "true") {
      throw new Error(
        "OpenAI person analysis disabled — configure Azure OpenAI or set ALLOW_OPENAI_AI_FALLBACK=true"
      );
    }
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

  async generateLooks(input: GenerateLooksInput): Promise<GenerateLooksResult> {
    if (process.env.ALLOW_OPENAI_AI_FALLBACK !== "true") {
      throw new Error(
        "OpenAI look planning disabled — configure Azure OpenAI or set ALLOW_OPENAI_AI_FALLBACK=true"
      );
    }
    const c = client();
    const completion = await c.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Return JSON {"looks":[${resolveLookCount(input)} outfit plans],"retailerSites":[]}`,
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    const parsed = raw
      ? (JSON.parse(raw) as { looks?: PlannedLook[]; retailerSites?: unknown })
      : { looks: [] };
    return {
      looks: padLooksToCount(parsed.looks ?? [], resolveLookCount(input)),
      retailerSites: undefined,
    };
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

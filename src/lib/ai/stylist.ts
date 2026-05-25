import { getChatClient } from "@/lib/azure/openai";
import { getAIProvider, getAIProviderName } from "@/lib/ai/provider";

const STYLIST_SYSTEM = `You are Aurafit — a world-class personal fashion stylist. You are concise, warm, editorial, never cheesy.
You reason about body proportion, palette, occasion, location climate, and budget. You avoid generic AI filler.
When suggesting outfits, number options clearly (1–6) and name specific garment types and colors.`;

export async function stylistChat(messages: { role: string; content: string }[]) {
  if (getAIProviderName() === "azure") {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
    return client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: STYLIST_SYSTEM },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      stream: true,
    });
  }

  const provider = getAIProvider();
  const stream = provider.generateChat([
    { role: "system", content: STYLIST_SYSTEM },
    ...messages,
  ]);

  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of stream) {
        yield { choices: [{ delta: { content: chunk } }] };
      }
    },
  };
}

export async function recommendOutfitNarrative(context: {
  occasion?: string;
  location?: string;
  budget?: string;
  style?: string;
  wardrobeSummary?: string;
}): Promise<string> {
  const provider = getAIProvider();
  let text = "";
  const stream = provider.generateChat([
    { role: "system", content: STYLIST_SYSTEM },
    {
      role: "user",
      content: `Propose 4 distinct outfit directions (numbered) for:
Occasion: ${context.occasion ?? "unspecified"}
Location: ${context.location ?? "unspecified"}
Budget: ${context.budget ?? "flexible"}
Style: ${context.style ?? "modern minimal"}
Wardrobe: ${context.wardrobeSummary ?? "not provided"}`,
    },
  ]);
  for await (const chunk of stream) {
    text += chunk;
  }
  return text;
}

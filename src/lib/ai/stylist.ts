import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getChatClient } from "@/lib/azure/openai";
import { getAIProvider, getAIProviderName } from "@/lib/ai/provider";
import {
  buildStylistContext,
  formatStylistContextBlock,
  type StylistContext,
} from "@/lib/ai/stylist-context";
import type { StylistNdjsonEvent } from "@/lib/ai/stylist-events";
import {
  runStylistTool,
  stylistAzureTools,
  toolStatusMessage,
  type StylistToolContext,
} from "@/lib/ai/stylist-tools";
import { isAllowedUserMediaUrl } from "@/lib/security/ssrf";

export const MAX_TOOL_ROUNDS = 4;

const STYLIST_SYSTEM = `You are Aurafit — a world-class personal fashion stylist. You are concise, warm, editorial, never cheesy.
You reason about body proportion, palette, occasion, location climate, and budget. You avoid generic AI filler.
When suggesting outfits, number options clearly and name specific garment types and colors.
Use the user's wardrobe and saved looks when relevant — reference specific pieces they own.

You have tools in this chat: generate 2–3 shoppable look boards on the user's photo, swap a slot and re-render, find closest shop matches from a garment photo, search verified products, save a piece to the wardrobe, and recall recent in-chat looks.

Hard rules:
- When the user asks for looks or a visual board in chat, call generate_looks (or combo_from_garment for a garment photo). Never send them to /generate for a look they asked for here. /generate is only an optional 6-panel studio.
- When calling generate_looks, set styleType to the user's named aesthetic (old money, office party, smart casual, etc.).
- You can render look boards in this chat. Never claim you cannot.
- Only share shop URLs returned by tools. Never invent product links.
- Generating or swapping a board uses a look credit — mention that briefly when you start one.
- Prefer 3 looks unless they ask for 2.
- visual_search is closest shoppable match, not an identical SKU.
- If a tool asks for a photo, ask them to attach one in chat.`;

function buildSystemPrompt(ctx: StylistContext): string {
  return `${STYLIST_SYSTEM}\n\n${formatStylistContextBlock(ctx)}`;
}

function allowedImageUrls(urls?: string[]): string[] {
  return (urls ?? []).filter((u) => isAllowedUserMediaUrl(u)).slice(0, 4);
}

function toAzureMessages(
  history: { role: string; content: string }[],
  imageUrls?: string[]
): ChatCompletionMessageParam[] {
  const images = allowedImageUrls(imageUrls);
  return history.map((m, i) => {
    const role = m.role as "user" | "assistant" | "system";
    const isLastUser =
      role === "user" &&
      i === history.length - 1 &&
      images.length > 0;
    if (isLastUser) {
      return {
        role: "user" as const,
        content: [
          { type: "text" as const, text: m.content },
          ...images.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "low" as const },
          })),
        ],
      };
    }
    return {
      role,
      content: m.content,
    };
  });
}

async function* runAzureToolLoop(
  systemPrompt: string,
  history: { role: string; content: string }[],
  toolCtx: StylistToolContext
): AsyncGenerator<StylistNdjsonEvent> {
  const client = getChatClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...toAzureMessages(history, toolCtx.imageUrls),
  ];

  let pendingText: string | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: deployment,
      messages,
      tools: stylistAzureTools,
      tool_choice: "auto",
      max_tokens: 1024,
    });
    const msg = completion.choices[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        yield { type: "status", message: toolStatusMessage(call.function.name) };
        const result = await runStylistTool(
          call.function.name,
          call.function.arguments ?? "{}",
          toolCtx
        );
        if (result.code && result.message) {
          yield { type: "error", message: result.message };
        }
        if (result.jobId) {
          yield {
            type: "looks",
            jobId: result.jobId,
            status: result.status ?? "queued",
            boardImageUrl: result.boardImageUrl,
            looks: result.lastLooks,
          };
        }
        if (result.products?.length) {
          yield { type: "products", products: result.products };
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      pendingText = null;
      continue;
    }

    pendingText = msg.content ?? "";
    break;
  }

  if (pendingText) {
    yield { type: "text", delta: pendingText };
    return;
  }

  const stream = await client.chat.completions.create({
    model: deployment,
    messages,
    max_tokens: 1024,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield { type: "text", delta };
  }
}

export async function* stylistChat(
  messages: { role: string; content: string }[],
  options?: {
    userId?: string;
    conversationId?: string;
    imageUrls?: string[];
  }
): AsyncGenerator<StylistNdjsonEvent> {
  let contextBlock = STYLIST_SYSTEM;
  if (options?.userId) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const ctx = await buildStylistContext(options.userId, lastUser?.content);
    contextBlock = buildSystemPrompt(ctx);
  }

  if (getAIProviderName() === "azure" && options?.userId && options.conversationId) {
    yield* runAzureToolLoop(contextBlock, messages, {
      userId: options.userId,
      conversationId: options.conversationId,
      imageUrls: options.imageUrls,
    });
    return;
  }

  const provider = getAIProvider();
  const stream = provider.generateChat([
    { role: "system", content: contextBlock },
    ...messages,
  ]);
  for await (const chunk of stream) {
    if (chunk) yield { type: "text", delta: chunk };
  }
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

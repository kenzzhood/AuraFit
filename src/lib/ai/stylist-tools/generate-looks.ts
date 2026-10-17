import {
  EntitlementError,
  assertCanGenerate,
} from "@/lib/billing/entitlements";
import { enqueueChatGenerationJob } from "./enqueue";
import { resolveUserPhotoUrl } from "./photo";
import type { StylistToolContext, StylistToolResult } from "./types";

function lookCountFromArgs(args: Record<string, unknown>): 2 | 3 {
  return args.lookCount === 2 ? 2 : 3;
}

export function chatLooksJobFields(args: Record<string, unknown>): {
  styleType?: string;
  style?: string;
  occasion?: string;
  location?: string;
  budgetMax?: number;
  lookCount: 2 | 3;
} {
  const occasion =
    typeof args.occasion === "string" ? args.occasion : undefined;
  const argStyle =
    typeof args.style === "string" ? args.style.trim() : undefined;
  const argStyleType =
    typeof args.styleType === "string" ? args.styleType.trim() : undefined;
  const styleType = argStyleType || argStyle || undefined;
  // Pass raw preference text. processGenerationJob joins styleType +
  // occasion + style once via joinShoppingStyle.
  const style = argStyle || undefined;
  const location =
    typeof args.location === "string" ? args.location : undefined;
  const budgetMax =
    typeof args.budgetMax === "number" ? args.budgetMax : undefined;
  return {
    styleType: styleType || undefined,
    style,
    occasion,
    location,
    budgetMax,
    lookCount: lookCountFromArgs(args),
  };
}

export async function handleGenerateLooks(
  ctx: StylistToolContext,
  args: Record<string, unknown>
): Promise<StylistToolResult> {
  const userPhotoUrl = await resolveUserPhotoUrl(ctx);
  if (!userPhotoUrl) {
    return {
      ok: false,
      needPhoto: true,
      message:
        "Ask the user to attach a photo of themselves so you can render looks in this chat. Do not send them to /generate.",
    };
  }

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanGenerate(ctx.userId);
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return {
        ok: false,
        error: e.message,
        code: e.code,
        message: e.message,
      };
    }
    throw e;
  }

  const fields = chatLooksJobFields(args);

  const jobId = await enqueueChatGenerationJob({
    userId: ctx.userId,
    reservationId,
    input: {
      path: "online",
      userPhotoUrl,
      occasion: fields.occasion,
      styleType: fields.styleType,
      style: fields.style,
      location: fields.location,
      budgetMax: fields.budgetMax,
      lookCount: fields.lookCount,
      source: "chat",
      conversationId: ctx.conversationId,
      renderQuality: "medium",
    },
  });

  return {
    ok: true,
    jobId,
    status: "queued",
    message: `Queued ${fields.lookCount} shoppable looks (job ${jobId}). Tell the user the board is rendering in this chat and that this uses a look credit. Do not send them to /generate.`,
  };
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { chatMessageSchema } from "@/types/api";
import { stylistChat } from "@/lib/ai/stylist";
import { encodeNdjson, type StylistNdjsonEvent } from "@/lib/ai/stylist-events";
import { ensureAppUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { CHAT_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";
import {
  assertAllowedUserMediaUrl,
  UnsafeUrlError,
} from "@/lib/security/ssrf";
import type { StylistProductCard } from "@/lib/ai/stylist-events";
import type { GenerationLookResult } from "@/types/generation";
import { conversationTitleFromUserText } from "@/lib/chat/conversations";
import { enrichChatMessages } from "@/lib/chat/enrich-messages";

export const maxDuration = 300;

async function requireChatUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const cu = await currentUser();
  return ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
}

export async function GET(req: Request) {
  const user = await requireChatUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId required" },
      { status: 400 }
    );
  }

  const owned = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 80 },
    },
  });
  if (!owned) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await enrichChatMessages(owned.messages, user.id);

  return NextResponse.json({
    conversationId: owned.id,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireChatUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lim = await rateLimit(
    `chat:${user.id}`,
    CHAT_RATE_LIMIT.limit,
    CHAT_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("chat", lim.retryAfterSec);
  }

  try {
    const { assertCanChat } = await import("@/lib/billing/entitlements");
    await assertCanChat(user.id);
  } catch (e) {
    const { EntitlementError } = await import("@/lib/billing/entitlements");
    if (e instanceof EntitlementError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 402 }
      );
    }
    throw e;
  }

  const parsed = chatMessageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const imageUrls = parsed.data.imageUrls ?? [];
  for (const url of imageUrls) {
    try {
      assertAllowedUserMediaUrl(url);
    } catch (e) {
      const msg =
        e instanceof UnsafeUrlError
          ? "imageUrls must be uploaded Aurafit media"
          : "Invalid imageUrls";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const owned = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  } else {
    const c = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: conversationTitleFromUserText(parsed.data.message),
        context: {},
      },
    });
    conversationId = c.id;
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: parsed.data.message,
      metadata: imageUrls.length ? { imageUrls } : undefined,
    },
  });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  let iterator: AsyncIterator<StylistNdjsonEvent>;
  let first: IteratorResult<StylistNdjsonEvent>;
  try {
    iterator = stylistChat(
      history.map((m) => ({ role: m.role, content: m.content })),
      {
        userId: user.id,
        conversationId,
        imageUrls: imageUrls.length ? imageUrls : undefined,
      }
    )[Symbol.asyncIterator]();
    first = await iterator.next();
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "OpenAI not configured or request failed" },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let full = "";
      const jobIds: string[] = [];
      let lastLooks: GenerationLookResult[] | undefined;
      let lastProducts: StylistProductCard[] | undefined;
      const emit = (event: StylistNdjsonEvent) => {
        if (event.type === "text") full += event.delta;
        if (event.type === "looks") {
          jobIds.push(event.jobId);
          if (event.looks) lastLooks = event.looks;
        }
        if (event.type === "products") {
          lastProducts = event.products;
        }
        controller.enqueue(encoder.encode(encodeNdjson(event)));
      };
      try {
        if (!first.done && first.value) emit(first.value);
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          emit(next.value);
        }
        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: full || "(no response)",
            metadata: {
              jobIds: [...new Set(jobIds)],
              lastLooks,
              lastProducts,
            },
          },
        });
      } catch (err) {
        console.error(err);
        try {
          controller.enqueue(
            encoder.encode(
              encodeNdjson({
                type: "error",
                message:
                  err instanceof Error ? err.message : "Stylist request failed",
              })
            )
          );
        } catch {
          /* closed */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Conversation-Id": conversationId,
    },
  });
}

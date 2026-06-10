import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { chatMessageSchema } from "@/types/api";
import { stylistChat } from "@/lib/ai/stylist";
import { ensureAppUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { CHAT_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const lim = await rateLimit(
    `chat:${user.id}`,
    CHAT_RATE_LIMIT.limit,
    CHAT_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("chat", lim.retryAfterSec);
  }

  const parsed = chatMessageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
  } else {
    const c = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: "Stylist",
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
    },
  });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  let stream;
  try {
    stream = await stylistChat(
      history.map((m) => ({ role: m.role, content: m.content }))
    );
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
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            full += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: full || "(no response)",
          },
        });
      } catch (err) {
        console.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": conversationId,
    },
  });
}

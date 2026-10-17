"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatLooksEmbed, ChatProductsEmbed, mergeChatJobPoll } from "./ChatEmbeds";
import { ChatSessionList } from "./ChatSessionList";
import { createNdjsonParser } from "@/lib/ai/stylist-events";
import type { StylistProductCard } from "@/lib/ai/stylist-events";
import type { GenerationLookResult } from "@/types/generation";

const CONV_KEY = "aurafit:chat:conversationId";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  jobId?: string;
  jobStatus?: string;
  jobError?: string | null;
  boardImageUrl?: string;
  looks?: GenerationLookResult[];
  products?: StylistProductCard[];
  statusLine?: string;
};

type HydratedMessage = {
  id: string;
  role: string;
  content: string;
  metadata?: {
    imageUrls?: string[];
    jobIds?: string[];
    lastLooks?: GenerationLookResult[];
    lastProducts?: StylistProductCard[];
    boardImageUrl?: string | null;
    jobStatus?: string;
    jobError?: string | null;
  } | null;
};

function isPollableJobStatus(status?: string): boolean {
  return (
    status === "queued" ||
    status === "processing" ||
    status === "QUEUED" ||
    status === "PROCESSING"
  );
}

function embedFor(m: Msg) {
  const looks = m.jobId || m.boardImageUrl || m.looks?.length;
  const products = m.products?.length;
  if (!looks && !products && !m.statusLine) return undefined;
  return (
    <>
      {m.statusLine && !m.content ? (
        <p className="mb-2 text-xs text-aura-muted">{m.statusLine}</p>
      ) : null}
      {looks ? (
        <ChatLooksEmbed
          jobStatus={m.jobStatus}
          boardImageUrl={m.boardImageUrl}
          looks={m.looks}
          error={m.jobError}
        />
      ) : null}
      {products ? <ChatProductsEmbed products={m.products!} /> : null}
    </>
  );
}

function mapHydratedMessages(messages: HydratedMessage[]): Msg[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    imageUrls: m.metadata?.imageUrls,
    jobId: m.metadata?.jobIds?.[0],
    jobStatus: m.metadata?.jobStatus,
    jobError: m.metadata?.jobError,
    boardImageUrl: m.metadata?.boardImageUrl ?? undefined,
    looks: m.metadata?.lastLooks,
    products: m.metadata?.lastProducts,
  }));
}

export function ChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("c");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [hydrating, setHydrating] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const localSessionRef = useRef<string | undefined>(undefined);

  const rememberConversation = (id: string) => {
    setConversationId(id);
    localSessionRef.current = id;
    try {
      sessionStorage.setItem(CONV_KEY, id);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!sessionId) {
      localSessionRef.current = undefined;
      setConversationId(undefined);
      setMessages([]);
      setHydrating(false);
      return;
    }

    if (localSessionRef.current === sessionId) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    setHydrating(true);
    setMessages([]);
    setConversationId(sessionId);

    void (async () => {
      try {
        const r = await fetch(
          `/api/chat?conversationId=${encodeURIComponent(sessionId)}`
        );
        if (!r.ok) {
          if (!cancelled) {
            setMessages([]);
            setConversationId(undefined);
            localSessionRef.current = undefined;
          }
          return;
        }
        const data = (await r.json()) as {
          conversationId: string;
          messages: HydratedMessage[];
        };
        if (cancelled) return;
        rememberConversation(data.conversationId);
        setMessages(mapHydratedMessages(data.messages));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const refreshJob = useCallback(async (jobId: string) => {
    const r = await fetch(`/api/generate/status/${jobId}`);
    if (!r.ok) return;
    const job = (await r.json()) as {
      status: string;
      error?: string | null;
      result?: {
        boardImageUrl?: string | null;
        looks?: GenerationLookResult[];
      };
    };
    setMessages((prev) =>
      prev.map((m) => (m.jobId === jobId ? mergeChatJobPoll(m, job) : m))
    );
  }, []);

  const pendingJobKey = messages
    .filter((m) => m.jobId && isPollableJobStatus(m.jobStatus))
    .map((m) => m.jobId!)
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .sort()
    .join("|");

  useEffect(() => {
    const activeIds = pendingJobKey ? pendingJobKey.split("|") : [];
    if (!activeIds.length) return;
    const timer = setInterval(() => {
      for (const id of activeIds) void refreshJob(id);
    }, 2000);
    for (const id of activeIds) void refreshJob(id);
    return () => clearInterval(timer);
  }, [pendingJobKey, refreshJob]);

  const onSend = async (text: string, imageUrls: string[]) => {
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      imageUrls: imageUrls.length ? imageUrls : undefined,
    };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: text,
        imageUrls: imageUrls.length ? imageUrls : undefined,
      }),
      signal: abortRef.current.signal,
    });

    const cid = r.headers.get("X-Conversation-Id");
    if (cid) {
      rememberConversation(cid);
      if (!sessionId) {
        router.replace(`/chat?c=${encodeURIComponent(cid)}`);
      }
    }

    if (!r.ok) {
      let err = "Could not reach the stylist.";
      try {
        const data = (await r.json()) as { error?: string };
        if (data.error) err = data.error;
      } catch {
        /* ignore */
      }
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId ? { ...msg, content: err } : msg
        )
      );
      return;
    }

    if (!r.body) return;

    const parser = createNdjsonParser();
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    const applyEvents = (chunk: string, flush: boolean) => {
      const events = flush
        ? [...parser.push(chunk), ...parser.flush()]
        : parser.push(chunk);
      for (const ev of events) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantId) return msg;
            if (ev.type === "text") {
              return { ...msg, content: msg.content + ev.delta };
            }
            if (ev.type === "status") {
              return { ...msg, statusLine: ev.message };
            }
            if (ev.type === "looks") {
              return {
                ...msg,
                jobId: ev.jobId,
                jobStatus: ev.status === "done" ? "DONE" : "queued",
                boardImageUrl: ev.boardImageUrl ?? msg.boardImageUrl,
                looks: ev.looks ?? msg.looks,
              };
            }
            if (ev.type === "products") {
              return { ...msg, products: ev.products };
            }
            if (ev.type === "error") {
              return {
                ...msg,
                content: msg.content || ev.message,
                statusLine: ev.message,
              };
            }
            return msg;
          })
        );
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        applyEvents("", true);
        break;
      }
      applyEvents(dec.decode(value, { stream: true }), false);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="lg:w-72 lg:shrink-0">
        <div className="sticky top-4 rounded-2xl border border-aura-border bg-aura-ink/40 p-4">
          <ChatSessionList />
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-aura-sage">
            Stylist
          </p>
          <p className="mt-2 text-sm text-aura-dim">
            Attach a photo and I can generate 2–3 shoppable looks in this chat,
            swap a piece, or find closest shop matches. Shop links are always
            verified.
          </p>
          <p className="mt-3 text-xs text-aura-champagne">
            Generating looks uses a look credit.
          </p>
          <Link
            href="/generate"
            className="mt-3 inline-block text-xs font-medium text-aura-muted underline"
          >
            Optional 6-panel studio →
          </Link>
          <Link
            href="/wardrobe"
            className="mt-2 block text-xs text-aura-muted underline"
          >
            Manage wardrobe →
          </Link>
        </div>
      </aside>
      <div className="flex min-h-[60vh] flex-1 flex-col rounded-2xl border border-aura-border bg-aura-void/50">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {hydrating && (
            <p className="text-center text-sm text-aura-muted">Loading…</p>
          )}
          {!hydrating && messages.length === 0 && (
            <p className="text-center text-sm text-aura-muted">
              Start a conversation with your AI stylist.
            </p>
          )}
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              role={m.role}
              imageUrls={m.imageUrls}
              embedded={embedFor(m)}
            >
              {m.content}
              {m.statusLine && m.role === "assistant" && !m.jobId ? (
                <span className="mt-2 block text-xs text-aura-muted">
                  {m.statusLine}
                </span>
              ) : null}
            </ChatMessage>
          ))}
        </div>
        <ChatInput onSend={onSend} disabled={hydrating} />
      </div>
    </div>
  );
}

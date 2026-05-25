"use client";

import { useCallback, useRef, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import Link from "next/link";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export function ChatInterface() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  const appendAssistantDelta = useCallback((delta: string) => {
    setStreaming((s) => s + delta);
  }, []);

  const onSend = async (text: string) => {
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setStreaming("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        message: text,
      }),
      signal: abortRef.current.signal,
    });

    const cid = r.headers.get("X-Conversation-Id");
    if (cid) setConversationId(cid);

    if (!r.ok || !r.body) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Could not reach the stylist. Check OpenAI configuration.",
        },
      ]);
      return;
    }

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let acc = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      acc += chunk;
      appendAssistantDelta(chunk);
    }

    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: acc || "(no response)",
      },
    ]);
    setStreaming("");
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="lg:w-72 lg:shrink-0">
        <div className="sticky top-4 rounded-2xl border border-aura-border bg-aura-ink/40 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-aura-sage">
            Context
          </p>
          <p className="mt-2 text-sm text-aura-dim">
            Your last wardrobe uploads and generated outfits inform the stylist
            once wired to retrieval. For now, chat freely for styling advice.
          </p>
          <Link
            href="/wardrobe"
            className="mt-4 inline-block text-xs text-aura-champagne underline"
          >
            Manage wardrobe →
          </Link>
        </div>
      </aside>
      <div className="flex flex-1 min-h-[60vh] flex-col rounded-2xl border border-aura-border bg-aura-void/50">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !streaming && (
            <p className="text-center text-sm text-aura-muted">
              Start a conversation with your AI stylist.
            </p>
          )}
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role}>
              {m.content}
            </ChatMessage>
          ))}
          {streaming && (
            <ChatMessage role="assistant">{streaming}</ChatMessage>
          )}
        </div>
        <ChatInput onSend={onSend} />
      </div>
    </div>
  );
}

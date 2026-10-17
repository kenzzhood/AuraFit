"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
};

export function ChatSessionList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    []
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/conversations");
      if (!r.ok) return;
      const data = (await r.json()) as {
        conversations?: ConversationListItem[];
      };
      setConversations(data.conversations ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeId]);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-aura-sage">
          Threads
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/chat")}
        >
          New chat
        </Button>
      </div>
      {conversations.length === 0 ? (
        <p className="text-[11px] text-aura-muted">No past sessions yet.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => router.push(`/chat?c=${encodeURIComponent(c.id)}`)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-aura-champagne/50 bg-aura-champagne/10"
                      : "border-aura-border bg-aura-void/40 hover:border-aura-champagne/30"
                  )}
                >
                  <span className="block truncate text-sm text-aura-foreground">
                    {c.title}
                  </span>
                  {c.preview ? (
                    <span className="mt-0.5 block truncate text-[11px] text-aura-muted">
                      {c.preview}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

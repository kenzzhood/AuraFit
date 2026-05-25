"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChatMessage({
  role,
  children,
  embedded,
}: {
  role: "user" | "assistant";
  children: ReactNode;
  embedded?: ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-aura-champagne text-aura-void"
            : "border border-aura-border bg-aura-ink/60 text-aura-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{children}</div>
        {embedded && (
          <div className="mt-3 border-t border-aura-border/50 pt-3">{embedded}</div>
        )}
      </div>
    </div>
  );
}

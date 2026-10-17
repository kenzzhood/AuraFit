"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChatMessage({
  role,
  children,
  embedded,
  imageUrls,
}: {
  role: "user" | "assistant";
  children: ReactNode;
  embedded?: ReactNode;
  imageUrls?: string[];
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
        {imageUrls && imageUrls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">{children}</div>
        {embedded && (
          <div className="mt-3 border-t border-aura-border/50 pt-3">{embedded}</div>
        )}
      </div>
    </div>
  );
}

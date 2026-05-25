"use client";

import { useState } from "react";
import type { OutfitCategory, WardrobeItem } from "@prisma/client";
import { ItemTagEditor } from "./ItemTagEditor";
import { cn } from "@/lib/utils";

type Item = WardrobeItem & { readUrl?: string };

export function ClothingCard({
  item,
  onUpdated,
  onDeleted,
}: {
  item: Item;
  onUpdated: () => void;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = item.tags as string[] | null;

  const img = item.readUrl ?? item.imageUrl;

  // Build a friendly label for the confirm dialog so the user knows
  // exactly which piece is going away.
  const labels = (item.styleLabels ?? null) as
    | { description?: string; caption?: string }
    | null;
  const friendlyLabel =
    labels?.description ||
    labels?.caption ||
    `${String(item.category).toLowerCase()} piece`;

  const handleDelete = async () => {
    if (isDeleting) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Delete this ${friendlyLabel}? This permanently removes it from your wardrobe.`
      );
      if (!ok) return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        let message = "Failed to delete";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {}
        throw new Error(message);
      }
      onDeleted?.();
    } catch (err) {
      console.error("wardrobe delete failed", err);
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/50 transition",
        isDeleting && "pointer-events-none opacity-50"
      )}
    >
      <div className="relative aspect-[3/4] bg-aura-highlight/20">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-aura-muted">
            No preview
          </div>
        )}

        <button
          type="button"
          aria-label={`Delete ${friendlyLabel}`}
          disabled={isDeleting}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDelete();
          }}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-aura-border bg-aura-void/80 text-aura-muted backdrop-blur-sm transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {isDeleting ? (
            <span
              aria-hidden
              className="h-3 w-3 animate-spin rounded-full border border-aura-muted border-t-transparent"
            />
          ) : (
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M3 4h10" />
              <path d="M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
              <path d="M4.5 4l.5 8.5a1.5 1.5 0 0 0 1.5 1.4h3a1.5 1.5 0 0 0 1.5-1.4L11.5 4" />
              <path d="M7 7v4" />
              <path d="M9 7v4" />
            </svg>
          )}
        </button>
      </div>
      <div className="p-3">
        <span
          className={cn(
            "inline-block rounded-md bg-aura-highlight px-2 py-0.5 text-[10px] uppercase tracking-wider text-aura-champagne"
          )}
        >
          {item.category}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {(tags ?? []).slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] text-aura-dim">
              #{t}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 text-xs text-aura-champagne underline underline-offset-2"
        >
          {open ? "Close editor" : "Edit tags"}
        </button>
        {error && (
          <p className="mt-2 text-[11px] text-red-300">{error}</p>
        )}
      </div>
      {open && (
        <div className="border-t border-aura-border bg-aura-void/95 p-3">
          <ItemTagEditor
            category={item.category}
            tags={tags}
            notes={item.notes}
            onSave={async (data) => {
              await fetch(`/api/wardrobe/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  category: data.category as OutfitCategory,
                  tags: data.tags,
                  notes: data.notes,
                }),
              });
              onUpdated();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

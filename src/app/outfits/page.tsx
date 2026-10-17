"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Outfit } from "@prisma/client";

type OutfitRow = Outfit & {
  snapshot?: {
    boardImageUrl?: string | null;
    looks?: Array<{ label?: string }>;
  } | null;
};

function boardFromSnapshot(o: OutfitRow): string | null {
  const snap = o.snapshot as OutfitRow["snapshot"];
  if (snap && typeof snap === "object" && "boardImageUrl" in snap) {
    return snap.boardImageUrl ?? null;
  }
  return null;
}

export default function OutfitsPage() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["outfits"],
    queryFn: async () => {
      const r = await fetch("/api/outfits");
      if (!r.ok) throw new Error("outfits");
      return r.json() as Promise<OutfitRow[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete outfit");
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["outfits"] });
      const prev = queryClient.getQueryData<OutfitRow[]>(["outfits"]);
      queryClient.setQueryData<OutfitRow[]>(["outfits"], (old) =>
        (old ?? []).filter((o) => o.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["outfits"], ctx.prev);
    },
    onSettled: (id) => {
      queryClient.invalidateQueries({ queryKey: ["outfits"] });
      if (id) queryClient.removeQueries({ queryKey: ["outfit", id] });
    },
  });

  const handleDelete = (id: string, name: string | null) => {
    if (deleteMutation.isPending) return;
    const label = name?.trim() || "this saved outfit";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete ${label}? This permanently removes the outfit and any post you created from it.`
      )
    ) {
      return;
    }
    setPendingDeleteId(id);
    deleteMutation.mutate(id, {
      onSettled: () => setPendingDeleteId((curr) => (curr === id ? null : curr)),
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Library
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Saved looks
      </h1>
      <p className="mt-3 max-w-lg text-sm text-aura-dim">
        Outfits you saved from styling sessions.
      </p>

      {q.isLoading && (
        <p className="mt-8 text-sm text-aura-muted">Loading…</p>
      )}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((o) => {
          const img = boardFromSnapshot(o);
          const isDeleting = pendingDeleteId === o.id;
          return (
            <div
              key={o.id}
              className={`group relative overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/40 transition hover:border-aura-champagne/40 ${
                isDeleting ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Link href={`/outfits/${o.id}`} className="block">
                <div className="aspect-[3/4] bg-aura-highlight/10">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={o.name ?? o.occasion ?? "Saved outfit"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-aura-muted">
                      {o.occasion ?? "Saved outfit"}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <p className="font-medium text-aura-foreground">
                    {o.name ?? "Outfit"}
                  </p>
                  {o.occasion && (
                    <p className="text-xs text-aura-dim">{o.occasion}</p>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-aura-muted">
                    View details →
                  </p>
                </div>
              </Link>

              <button
                type="button"
                aria-label={`Delete ${o.name ?? "outfit"}`}
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(o.id, o.name);
                }}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-aura-border bg-aura-void/80 text-aura-muted backdrop-blur-sm transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
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
          );
        })}
      </div>
      {!q.isLoading && (q.data?.length ?? 0) === 0 && (
        <p className="mt-8 text-sm text-aura-muted">
          No saved outfits yet — generate and save from Style.
        </p>
      )}
      {deleteMutation.isError && (
        <p className="mt-6 text-xs text-red-300">
          Couldn’t delete that outfit. Please try again.
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Outfit } from "@prisma/client";
import { LookSelector } from "@/components/generate/LookSelector";
import { LookDetailPanel } from "@/components/generate/LookDetailPanel";
import type { GenerationLookResult } from "@/types/generation";

type OutfitSnapshot = {
  boardImageUrl?: string | null;
  looks?: GenerationLookResult[];
  lookIndex?: number;
  styleType?: string;
  occasion?: string;
  location?: string;
};

type OutfitRow = Outfit & { snapshot?: OutfitSnapshot | null };

export default function SavedOutfitPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const [selectedLook, setSelectedLook] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["outfit", id],
    queryFn: async () => {
      const r = await fetch(`/api/outfits/${id}`);
      if (!r.ok) throw new Error("outfit");
      return r.json() as Promise<OutfitRow>;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (outfitId: string) => {
      const r = await fetch(`/api/outfits/${outfitId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to delete outfit");
      }
      return outfitId;
    },
    onSuccess: (outfitId) => {
      queryClient.removeQueries({ queryKey: ["outfit", outfitId] });
      queryClient.invalidateQueries({ queryKey: ["outfits"] });
      router.push("/outfits");
    },
  });

  const handleDelete = () => {
    if (!q.data || deleteMutation.isPending) return;
    const label = q.data.name?.trim() || "this outfit";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete ${label}? This permanently removes the outfit and any post you created from it.`
      )
    ) {
      return;
    }
    deleteMutation.mutate(q.data.id);
  };

  const snap = q.data?.snapshot as OutfitSnapshot | null | undefined;
  const looks = snap?.looks ?? [];
  const boardImageUrl = snap?.boardImageUrl ?? null;
  const defaultLook =
    snap?.lookIndex != null && snap.lookIndex >= 0 && snap.lookIndex < looks.length
      ? snap.lookIndex
      : 0;
  const activeLook = selectedLook ?? (looks.length ? defaultLook : null);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/outfits"
        className="text-xs text-aura-muted underline underline-offset-2"
      >
        ← Back to saved looks
      </Link>

      {q.isLoading && (
        <p className="mt-8 text-sm text-aura-muted">Loading saved look…</p>
      )}

      {q.isError && (
        <p className="mt-8 text-sm text-red-300">Could not load this outfit.</p>
      )}

      {q.data && (
        <div className="mt-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
                Saved look
              </p>
              <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
                {q.data.name ?? "Outfit"}
              </h1>
              {(q.data.occasion || snap?.styleType) && (
                <p className="mt-2 text-sm text-aura-dim">
                  {[snap?.styleType, q.data.occasion].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-aura-border bg-aura-ink/40 px-4 py-2 text-xs font-medium text-aura-muted transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <>
                  <span
                    aria-hidden
                    className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
                  />
                  Deleting…
                </>
              ) : (
                <>
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
                  Delete
                </>
              )}
            </button>
          </div>

          {deleteMutation.isError && (
            <p className="text-xs text-red-300">
              Couldn’t delete this outfit. Please try again.
            </p>
          )}

          {looks.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <LookSelector
                boardImageUrl={boardImageUrl}
                selectedLook={activeLook}
                onSelectLook={setSelectedLook}
              />
              <LookDetailPanel
                look={activeLook != null ? looks[activeLook] ?? null : null}
                lookIndex={activeLook}
                outfitId={q.data.id}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-aura-border bg-aura-ink/40 p-8 text-center">
              {boardImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boardImageUrl}
                  alt=""
                  className="mx-auto max-h-[70vh] rounded-xl object-contain"
                />
              ) : (
                <p className="text-sm text-aura-muted">
                  No detailed breakdown saved for this outfit.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import type { WardrobeItem } from "@prisma/client";
import { ClothingCard } from "./ClothingCard";
import { WardrobeUploader } from "./WardrobeUploader";

type ItemWithUrl = WardrobeItem & { readUrl?: string; wardrobeId?: string };

export function WardrobeGrid() {
  const q = useQuery({
    queryKey: ["wardrobe"],
    queryFn: async () => {
      const r = await fetch("/api/wardrobe");
      if (!r.ok) throw new Error("Failed to load wardrobe");
      return r.json() as Promise<
        Array<{
          id: string;
          items: ItemWithUrl[];
        }>
      >;
    },
  });

  const items: ItemWithUrl[] =
    q.data?.flatMap((w) => w.items.map((it) => ({ ...it, wardrobeId: w.id }))) ??
    [];

  return (
    <div className="space-y-8">
      <WardrobeUploader onUploaded={() => q.refetch()} />
      {q.isLoading && (
        <p className="text-sm text-aura-muted">Loading wardrobe…</p>
      )}
      {q.error && (
        <p className="text-sm text-red-400">
          {(q.error as Error).message}
        </p>
      )}
      <div className="columns-2 gap-4 space-y-4 sm:columns-3 lg:columns-4">
        {items.map((item) => (
          <div key={item.id as string} className="break-inside-avoid">
            <ClothingCard
              item={item}
              onUpdated={() => q.refetch()}
              onDeleted={() => q.refetch()}
            />
          </div>
        ))}
      </div>
      {!q.isLoading && items.length === 0 && (
        <p className="text-center text-sm text-aura-muted">
          No pieces yet — upload your first look.
        </p>
      )}
    </div>
  );
}

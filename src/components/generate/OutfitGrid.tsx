"use client";

import { OutfitCard, type LookProduct } from "./OutfitCard";

export type LookRow = {
  imageUrl?: string | null;
  products?: LookProduct[];
};

export function OutfitGrid({
  looks,
  onSaveLook,
  outfitId,
}: {
  looks: LookRow[];
  onSaveLook?: (lookIndex: number) => void;
  outfitId?: string | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {looks.map((look, i) => (
        <OutfitCard
          key={i}
          index={i}
          imageUrl={look.imageUrl}
          products={look.products}
          outfitId={outfitId}
          onSave={onSaveLook ? () => onSaveLook(i) : undefined}
        />
      ))}
    </div>
  );
}

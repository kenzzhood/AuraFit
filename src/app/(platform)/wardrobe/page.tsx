import { WardrobeGrid } from "@/components/wardrobe/WardrobeGrid";
import { BorderGlow } from "@/components/ui/border-glow";

export default function WardrobePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Wardrobe
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Your pieces
      </h1>
      <p className="mt-3 max-w-lg text-sm text-aura-dim">
        Upload clothing shots — we analyze tags and keep embeddings for styling
        rerank.
      </p>
      <BorderGlow className="mt-10" innerClassName="p-6 md:p-8">
        <WardrobeGrid />
      </BorderGlow>
    </div>
  );
}

import type { Metadata } from "next";
import { PostFeed } from "@/components/social/PostFeed";

export const metadata: Metadata = {
  title: "Explore looks",
  description:
    "Discover AI-styled outfits from the Aurafit community. Tap a look to shop the same pieces.",
  alternates: { canonical: "/explore" },
};

export default function ExplorePage() {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-aura-sage">
        Atelier
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium text-aura-foreground md:text-4xl">
        Explore looks
      </h1>
      <p className="mt-2 max-w-xl text-sm text-aura-dim">
        Discover AI-styled outfits from the community. Tap a card to shop the
        same pieces.
      </p>
      <div className="mt-10">
        <PostFeed />
      </div>
    </div>
  );
}

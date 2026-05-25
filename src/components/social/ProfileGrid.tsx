"use client";

import Link from "next/link";
import type { GeneratedImage, Outfit, Post } from "@prisma/client";

type GridPost = Post & {
  outfit: Outfit & { generatedImages: GeneratedImage[] };
  _count?: { likes: number; comments: number };
};

export function ProfileGrid({ posts }: { posts: GridPost[] }) {
  return (
    <div className="columns-2 gap-3 space-y-3 sm:columns-3">
      {posts.map((p) => {
        const img = p.outfit.generatedImages[0]?.cdnUrl;
        return (
          <Link
            key={p.id}
            href={`/post/${p.id}`}
            className="block break-inside-avoid overflow-hidden rounded-xl border border-aura-border"
          >
            <div className="aspect-square bg-aura-highlight/10">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-aura-muted">
                  Post
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

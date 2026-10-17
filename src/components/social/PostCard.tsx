"use client";

import Link from "next/link";
import type { GeneratedImage, Outfit, Post, User } from "@prisma/client";

type PostWithRelations = Post & {
  user: Pick<User, "id" | "username" | "displayName" | "profileImageUrl">;
  outfit: Outfit & { generatedImages: GeneratedImage[] };
  _count?: { likes: number; comments: number };
};

function postImage(p: PostWithRelations): string | null {
  const gi = p.outfit.generatedImages[0];
  return gi?.cdnUrl ?? null;
}

export function PostCard({ post }: { post: PostWithRelations }) {
  const img = postImage(post);
  const likes = post._count?.likes ?? 0;

  return (
    <Link
      href={`/post/${post.id}`}
      className="group block overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/40 transition hover:border-aura-champagne/40"
    >
      <div className="relative aspect-[3/4] bg-gradient-to-br from-aura-highlight/20 to-aura-ink">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={
              post.caption?.trim() ||
              `Look by @${post.user.username ?? "user"}`
            }
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-aura-muted">
            Outfit
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-aura-highlight" />
          <span className="truncate text-xs text-aura-foreground">
            @{post.user.username ?? "user"}
          </span>
        </div>
        {post.caption && (
          <p className="mt-2 line-clamp-2 text-xs text-aura-dim">{post.caption}</p>
        )}
        <p className="mt-2 text-[10px] text-aura-muted">{likes} likes</p>
        <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-aura-champagne">
          Shop this look →
        </span>
      </div>
    </Link>
  );
}

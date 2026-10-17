"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PostCard } from "./PostCard";
import type { GeneratedImage, Outfit, Post, User } from "@prisma/client";

type PostWithRelations = Post & {
  user: Pick<User, "id" | "username" | "displayName" | "profileImageUrl">;
  outfit: Outfit & { generatedImages: GeneratedImage[] };
  _count?: { likes: number; comments: number };
};

export function PostFeed() {
  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<PostWithRelations[]>([]);

  const q = useQuery({
    queryKey: ["posts-feed", page],
    queryFn: async () => {
      const r = await fetch(`/api/posts?take=12&page=${page}`);
      if (!r.ok) throw new Error("feed");
      return r.json() as Promise<{
        posts: PostWithRelations[];
        hasMore: boolean;
        totalPages: number;
      }>;
    },
  });

  useEffect(() => {
    if (!q.data?.posts) return;
    setAllPosts((prev) =>
      page === 1 ? q.data!.posts : [...prev, ...q.data!.posts]
    );
  }, [q.data, page]);

  return (
    <div className="space-y-8">
      <div className="columns-2 gap-4 space-y-4 sm:columns-3 lg:columns-4">
        {allPosts.map((p) => (
          <div key={p.id} className="break-inside-avoid">
            <PostCard post={p} />
          </div>
        ))}
      </div>
      {q.isLoading && (
        <p className="text-center text-sm text-aura-muted">Loading feed…</p>
      )}
      {q.isError && (
        <p className="text-center text-sm text-aura-muted" role="alert">
          The look feed is unavailable right now. Try again in a moment.
        </p>
      )}
      {q.isSuccess && page === 1 && (q.data?.posts.length ?? 0) === 0 && (
        <p className="text-center text-sm text-aura-muted">
          No public looks yet. Generated outfits show up here once someone
          shares one.
        </p>
      )}
      {q.data && q.data.hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-aura-border px-6 py-2 text-sm text-aura-foreground hover:bg-aura-highlight"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

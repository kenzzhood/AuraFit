"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import type {
  GeneratedImage,
  Outfit,
  OutfitItem,
  Post,
  ProductCache,
  User,
  WardrobeItem,
} from "@prisma/client";

type PostDetailData = Post & {
  user: Pick<User, "id" | "username" | "displayName" | "profileImageUrl" | "bio">;
  outfit: Outfit & {
    generatedImages: GeneratedImage[];
    items: (OutfitItem & {
      productCache: ProductCache | null;
      wardrobeItem: WardrobeItem | null;
    })[];
  };
};

export function PostDetail({ postId }: { postId: string }) {
  const { isSignedIn } = useAuth();
  const [data, setData] = useState<{
    post: PostDetailData;
    likedByMe: boolean;
    likeCount: number;
    commentCount: number;
  } | null>(null);
  const [comments, setComments] = useState<
    Array<{
      id: string;
      content: string;
      createdAt: string;
      user: Pick<User, "username" | "displayName" | "profileImageUrl">;
    }>
  >([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/posts/${postId}`);
      const j = await r.json();
      if (r.ok) setData(j);
    })();
  }, [postId]);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/posts/${postId}/comments`);
      const j = await r.json();
      if (r.ok) setComments(j.comments ?? []);
    })();
  }, [postId, data?.commentCount]);

  if (!data) {
    return <p className="text-sm text-aura-muted">Loading…</p>;
  }

  const { post, likedByMe, likeCount } = data;
  const img = post.outfit.generatedImages[0]?.cdnUrl;

  const toggleLike = async () => {
    if (!isSignedIn) return;
    setBusy(true);
    try {
      if (likedByMe) {
        await fetch(`/api/posts/${postId}/like`, { method: "DELETE" });
        setData((d) =>
          d
            ? {
                ...d,
                likedByMe: false,
                likeCount: Math.max(0, d.likeCount - 1),
              }
            : d
        );
      } else {
        await fetch(`/api/posts/${postId}/like`, { method: "POST" });
        setData((d) =>
          d
            ? { ...d, likedByMe: true, likeCount: d.likeCount + 1 }
            : d
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async () => {
    if (!isSignedIn || !newComment.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const c = await r.json();
      if (r.ok) {
        setComments((prev) => [...prev, c]);
        setNewComment("");
      }
    } finally {
      setBusy(false);
    }
  };

  const products = post.outfit.items
    .map((i) => i.productCache)
    .filter(Boolean) as ProductCache[];

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/30">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={
              post.caption?.trim() ||
              `Look by @${post.user.username ?? "user"}`
            }
            className="w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center text-aura-muted">
            No preview
          </div>
        )}
      </div>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-aura-highlight" />
          <div>
            <Link
              href={`/profile/${post.user.username ?? ""}`}
              className="font-medium text-aura-foreground"
            >
              @{post.user.username}
            </Link>
            {post.user.bio && (
              <p className="text-xs text-aura-dim">{post.user.bio}</p>
            )}
          </div>
        </div>
        {post.caption && (
          <p className="text-sm text-aura-dim">{post.caption}</p>
        )}
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={!isSignedIn || busy}
            onClick={() => void toggleLike()}
            className="rounded-full border border-aura-border px-4 py-1.5 text-xs text-aura-foreground"
          >
            {likedByMe ? "♥ Liked" : "♡ Like"} ({likeCount})
          </button>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-aura-muted">
            Shop this look
          </p>
          <ul className="mt-3 space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <a
                  href={p.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-aura-champagne underline underline-offset-2"
                >
                  {p.title}
                </a>
                {p.price != null && (
                  <span className="ml-2 text-xs text-aura-dim">
                    ₹{p.price}
                  </span>
                )}
              </li>
            ))}
            {products.length === 0 && (
              <li className="text-xs text-aura-muted">No linked products.</li>
            )}
          </ul>
        </div>
        <div className="border-t border-aura-border pt-4">
          <p className="text-[10px] uppercase tracking-widest text-aura-muted">
            Comments
          </p>
          <ul className="mt-3 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium text-aura-champagne">
                  @{c.user.username}
                </span>{" "}
                <span className="text-aura-dim">{c.content}</span>
              </li>
            ))}
          </ul>
          {isSignedIn ? (
            <div className="mt-4 flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 rounded-lg border border-aura-border bg-aura-void px-3 py-2 text-sm"
                placeholder="Add a comment…"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitComment()}
                className="rounded-lg bg-aura-champagne px-3 py-2 text-xs font-medium text-aura-void"
              >
                Post
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-aura-muted">
              <Link href="/sign-in" className="text-aura-champagne underline">
                Sign in
              </Link>{" "}
              to comment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

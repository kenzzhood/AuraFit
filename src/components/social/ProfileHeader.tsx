"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export function ProfileHeader({
  username,
  displayName,
  bio,
  followerCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  onFollowChange,
}: {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollowChange?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  async function toggle() {
    if (!isSignedIn || isOwnProfile) return;
    setBusy(true);
    try {
      if (following) {
        await fetch("/api/follow", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        setFollowing(false);
      } else {
        await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        setFollowing(true);
      }
      onFollowChange?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex flex-col gap-4 border-b border-aura-border pb-8 sm:flex-row sm:items-start">
      <div className="h-24 w-24 shrink-0 rounded-full bg-aura-highlight" />
      <div className="flex-1">
        <h1 className="font-display text-3xl text-aura-foreground">
          @{username}
        </h1>
        {displayName && (
          <p className="text-sm text-aura-dim">{displayName}</p>
        )}
        <p className="mt-3 max-w-xl text-sm text-aura-muted">{bio}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-aura-dim">
          <span>{followerCount} followers</span>
          <span>{followingCount} following</span>
        </div>
        {!isOwnProfile && isSignedIn && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggle()}
            className="mt-4 rounded-full border border-aura-champagne px-5 py-2 text-xs font-medium text-aura-champagne"
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
      </div>
    </header>
  );
}

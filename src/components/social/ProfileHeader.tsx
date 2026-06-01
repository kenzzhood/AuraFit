"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

export function ProfileHeader({
  username,
  displayName,
  bio,
  profileImageUrl,
  followerCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  onFollowChange,
}: {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollowChange?: () => void;
}) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
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
      {profileImageUrl || (isOwnProfile && user?.imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profileImageUrl ?? user?.imageUrl ?? ""}
          alt=""
          className="h-24 w-24 shrink-0 rounded-full object-cover ring-1 ring-aura-border"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-aura-highlight ring-1 ring-aura-border">
          <span className="font-display text-2xl text-aura-muted">
            {(displayName ?? username).charAt(0).toUpperCase()}
          </span>
        </div>
      )}
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

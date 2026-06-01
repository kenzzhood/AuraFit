"use client";

import { useEffect, useState } from "react";
import { ProfileHeader } from "@/components/social/ProfileHeader";
import { ProfileGrid } from "@/components/social/ProfileGrid";
import type { GeneratedImage, Outfit, Post, User } from "@prisma/client";

type GridPost = Post & {
  outfit: Outfit & { generatedImages: GeneratedImage[] };
  _count?: { likes: number; comments: number };
};

type ProfilePayload = {
  profile: Pick<
    User,
    "id" | "username" | "displayName" | "bio" | "profileImageUrl" | "isPublic"
  >;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  posts: GridPost[];
  isOwnProfile: boolean;
};

export default function ProfilePageClient({
  username,
}: {
  username: string;
}) {
  const [data, setData] = useState<ProfilePayload | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      const j = await r.json();
      if (r.ok) setData(j);
    })();
  }, [username]);

  if (!data) {
    return <p className="text-sm text-aura-muted">Loading profile…</p>;
  }

  return (
    <div className="space-y-10">
      <ProfileHeader
        username={data.profile.username ?? username}
        displayName={data.profile.displayName}
        bio={data.profile.bio}
        profileImageUrl={data.profile.profileImageUrl}
        followerCount={data.followerCount}
        followingCount={data.followingCount}
        isFollowing={data.isFollowing}
        isOwnProfile={data.isOwnProfile}
        onFollowChange={() => {
          void (async () => {
            const r = await fetch(`/api/profile/${encodeURIComponent(username)}`);
            const j = await r.json();
            if (r.ok) setData(j);
          })();
        }}
      />
      <ProfileGrid posts={data.posts} />
    </div>
  );
}

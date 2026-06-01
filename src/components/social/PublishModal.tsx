"use client";

import { useState } from "react";

type PostVisibility = "PUBLIC" | "PRIVATE";

export function PublishModal({
  outfitId,
  open,
  onClose,
  onPublished,
}: {
  outfitId: string | null;
  open: boolean;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open || !outfitId) return null;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outfitId,
          caption: caption.trim() || undefined,
          visibility,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(typeof data.error === "string" ? data.error : "Publish failed");
        return;
      }
      onPublished?.();
      onClose();
      setCaption("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-aura-border bg-aura-ink p-6 shadow-xl">
        <h2 className="font-display text-xl text-aura-foreground">
          Publish to Atelier
        </h2>
        <p className="mt-1 text-xs text-aura-muted">
          Public posts appear on Explore. Private saves a draft to your profile
          only.
        </p>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Caption…"
          className="mt-4 w-full rounded-xl border border-aura-border bg-aura-void px-3 py-2 text-sm text-aura-foreground"
        />
        <div className="mt-4 flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-aura-dim">
            <input
              type="radio"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            Public
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-aura-dim">
            <input
              type="radio"
              checked={visibility === "PRIVATE"}
              onChange={() => setVisibility("PRIVATE")}
            />
            Private
          </label>
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-aura-border py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-aura-champagne py-2 text-sm font-medium text-aura-void"
          >
            {busy ? "Publishing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

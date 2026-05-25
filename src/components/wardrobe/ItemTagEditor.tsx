"use client";

import { useState } from "react";
import { OutfitCategory } from "@prisma/client";

const CATS = Object.values(OutfitCategory);

export function ItemTagEditor({
  category,
  tags,
  notes,
  onSave,
}: {
  category: OutfitCategory;
  tags: string[] | null | undefined;
  notes?: string | null;
  onSave: (data: {
    category: OutfitCategory;
    tags: string[];
    notes?: string;
  }) => Promise<void>;
}) {
  const [cat, setCat] = useState(category);
  const [tagStr, setTagStr] = useState(
    Array.isArray(tags) ? tags.join(", ") : ""
  );
  const [note, setNote] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs text-aura-muted">Category</label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as OutfitCategory)}
          className="mt-1 w-full rounded-lg border border-aura-border bg-aura-void px-2 py-1.5 text-aura-foreground"
        >
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-aura-muted">Tags (comma-separated)</label>
        <input
          value={tagStr}
          onChange={(e) => setTagStr(e.target.value)}
          className="mt-1 w-full rounded-lg border border-aura-border bg-aura-void px-2 py-1.5 text-aura-foreground"
          placeholder="denim, casual, summer"
        />
      </div>
      <div>
        <label className="text-xs text-aura-muted">Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-aura-border bg-aura-void px-2 py-1.5 text-aura-foreground"
        />
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              category: cat,
              tags: tagStr
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              notes: note || undefined,
            });
          } finally {
            setSaving(false);
          }
        }}
        className="w-full rounded-lg bg-aura-champagne py-2 text-xs font-medium text-aura-void"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

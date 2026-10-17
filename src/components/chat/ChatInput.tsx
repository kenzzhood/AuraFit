"use client";

import { useRef, useState, KeyboardEvent, ChangeEvent } from "react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.includes(",") ? r.split(",")[1]! : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type Preview = { url: string; local: string };

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string, imageUrls: string[]) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend =
    !busy &&
    !disabled &&
    !uploading &&
    (value.trim().length > 0 || previews.length > 0);

  const submit = async () => {
    const t = value.trim() || (previews.length ? "See attached photo." : "");
    if (!t || busy || disabled || uploading) return;
    setBusy(true);
    setValue("");
    const urls = previews.map((p) => p.url);
    setPreviews([]);
    try {
      await onSend(t, urls);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, 4 - previews.length);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const next: Preview[] = [];
      for (const f of files) {
        const local = URL.createObjectURL(f);
        const base64 = await fileToBase64(f);
        const up = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: f.name,
            contentType: f.type || "image/jpeg",
            kind: "chat",
            base64,
          }),
        });
        const data = (await up.json()) as { url?: string; error?: string };
        if (!up.ok || !data.url) {
          URL.revokeObjectURL(local);
          throw new Error(data.error ?? "Upload failed");
        }
        next.push({ url: data.url, local });
      }
      setPreviews((p) => [...p, ...next].slice(0, 4));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePreview = (url: string) => {
    setPreviews((p) => {
      const hit = p.find((x) => x.url === url);
      if (hit) URL.revokeObjectURL(hit.local);
      return p.filter((x) => x.url !== url);
    });
  };

  return (
    <div className="border-t border-aura-border bg-aura-void/90 p-3">
      {previews.length > 0 && (
        <div className="mb-2 flex gap-2">
          {previews.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => removePreview(p.url)}
              className="relative h-14 w-14 overflow-hidden rounded-lg border border-aura-border"
              aria-label="Remove photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.local} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {uploadError && (
        <p className="mb-2 text-xs text-red-400">{uploadError}</p>
      )}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e)}
        />
        <button
          type="button"
          disabled={busy || disabled || uploading || previews.length >= 4}
          onClick={() => fileRef.current?.click()}
          className="self-end rounded-xl border border-aura-border px-3 py-2 text-sm text-aura-muted hover:text-aura-foreground disabled:opacity-40"
          aria-label="Attach photo"
        >
          {uploading ? "…" : "📎"}
        </button>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          disabled={busy || disabled}
          rows={2}
          placeholder="Ask your stylist — attach a photo to generate looks…"
          className="flex-1 resize-none rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground placeholder:text-aura-muted"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void submit()}
          className="self-end rounded-xl bg-aura-champagne px-4 py-2 text-sm font-medium text-aura-void disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

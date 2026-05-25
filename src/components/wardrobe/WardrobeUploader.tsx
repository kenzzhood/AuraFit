"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

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

export function WardrobeUploader({
  onUploaded,
}: {
  onUploaded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "categorizing">(
    "idle"
  );
  const [msg, setMsg] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setBusy(true);
      setMsg(null);
      setStage("uploading");
      try {
        const base64 = await fileToBase64(f);
        const up = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: f.name,
            contentType: f.type || "image/jpeg",
            kind: "wardrobe",
            base64,
          }),
        });
        const data = await up.json();
        if (!up.ok) throw new Error(data.error ?? "Upload failed");

        // Server auto-detects the category via GPT-4o vision when we omit it.
        // Falls back to OTHER on any classifier failure — never blocks the
        // upload.
        setStage("categorizing");
        const w = await fetch("/api/wardrobe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobPath: data.path,
            imageUrl: data.url,
          }),
        });
        const item = await w.json();
        if (!w.ok) throw new Error(item.error ?? "Wardrobe save failed");
        setMsg("Added to wardrobe");
        onUploaded?.();
      } catch (e) {
        console.error(e);
        setMsg(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        setStage("idle");
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    disabled: busy,
  });

  return (
    <div className="rounded-2xl border border-aura-border bg-aura-ink/40 p-6">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border border-dashed border-aura-border p-8 text-center transition ${
          isDragActive ? "border-aura-champagne bg-aura-highlight/20" : ""
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-aura-muted">
          {stage === "uploading"
            ? "Uploading…"
            : stage === "categorizing"
              ? "Detecting category…"
              : "Drop a clothing photo or click to browse"}
        </p>
      </div>
      {msg && (
        <p
          className={`mt-3 text-xs ${msg.includes("fail") ? "text-red-400" : "text-aura-sage"}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

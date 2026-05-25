"use client";

import { useState, KeyboardEvent } from "react";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = value.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    setValue("");
    try {
      await onSend(t);
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

  return (
    <div className="flex gap-2 border-t border-aura-border bg-aura-void/90 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        disabled={busy || disabled}
        rows={2}
        placeholder="Ask your stylist…"
        className="flex-1 resize-none rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground placeholder:text-aura-muted"
      />
      <button
        type="button"
        disabled={busy || disabled || !value.trim()}
        onClick={() => void submit()}
        className="self-end rounded-xl bg-aura-champagne px-4 py-2 text-sm font-medium text-aura-void disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}

import type { GenerationLookResult } from "@/types/generation";

export type StylistProductCard = {
  title: string;
  productUrl: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  source: string;
  matchCategory?: string;
};

export type StylistNdjsonEvent =
  | { type: "text"; delta: string }
  | { type: "status"; message: string }
  | {
      type: "looks";
      jobId: string;
      status: "queued" | "done";
      boardImageUrl?: string;
      looks?: GenerationLookResult[];
    }
  | { type: "products"; products: StylistProductCard[] }
  | { type: "error"; message: string };

const EVENT_TYPES = new Set([
  "text",
  "status",
  "looks",
  "products",
  "error",
]);

export function encodeNdjson(event: StylistNdjsonEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function parseNdjsonLine(line: string): StylistNdjsonEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    if (typeof parsed.type !== "string" || !EVENT_TYPES.has(parsed.type)) {
      return null;
    }
    return parsed as StylistNdjsonEvent;
  } catch {
    return null;
  }
}

export function createNdjsonParser() {
  let buffer = "";
  const take = (chunk: string, flush: boolean): StylistNdjsonEvent[] => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = flush ? "" : (lines.pop() ?? "");
    if (flush && lines[lines.length - 1] === "") {
      lines.pop();
    }
    const events: StylistNdjsonEvent[] = [];
    for (const line of lines) {
      const event = parseNdjsonLine(line);
      if (event) events.push(event);
    }
    if (flush && buffer.trim()) {
      const event = parseNdjsonLine(buffer);
      buffer = "";
      if (event) events.push(event);
    }
    return events;
  };

  return {
    push(chunk: string): StylistNdjsonEvent[] {
      return take(chunk, false);
    },
    flush(): StylistNdjsonEvent[] {
      return take("", true);
    },
  };
}

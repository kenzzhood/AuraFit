import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeProductBatch } from "@/lib/ecommerce/normalize";
import { upsertProductIndexBatch } from "@/lib/ecommerce/index/persist";

const bodySchema = z.object({
  products: z.array(z.record(z.unknown())).max(50).default([]),
  source: z.string().optional(),
  region: z.enum(["IN", "US", "UK"]).optional(),
});

function keysMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Batch ingest from Scrapy indexer (not for public use).
 * Authorization: INGEST_API_KEY header.
 */
export async function POST(req: Request) {
  const key = req.headers.get("x-ingest-key");
  if (!keysMatch(key, process.env.INGEST_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > 1_000_000) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const items = parsed.data.products;
  const source = parsed.data.source ?? "scrapy";
  const region = parsed.data.region ?? "IN";

  const normalized = normalizeProductBatch(items, source, {
    region,
    currency: region === "US" ? "USD" : region === "UK" ? "GBP" : "INR",
  });

  const ids = await upsertProductIndexBatch(normalized, { embed: true });

  return NextResponse.json({ ingested: ids.length, ids });
}

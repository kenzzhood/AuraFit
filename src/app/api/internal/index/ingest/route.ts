import { NextResponse } from "next/server";
import { normalizeProductBatch } from "@/lib/ecommerce/normalize";
import { upsertProductIndexBatch } from "@/lib/ecommerce/index/persist";

/**
 * Batch ingest from Scrapy indexer (not for public use).
 * Authorization: INGEST_API_KEY header.
 */
export async function POST(req: Request) {
  const key = req.headers.get("x-ingest-key");
  if (!key || key !== process.env.INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    products?: Record<string, unknown>[];
    source?: string;
    region?: string;
  };

  const items = body.products ?? [];
  const source = body.source ?? "scrapy";
  const region = body.region ?? "IN";

  const normalized = normalizeProductBatch(items, source, {
    region,
    currency: region === "US" ? "USD" : region === "UK" ? "GBP" : "INR",
  });

  const ids = await upsertProductIndexBatch(normalized, { embed: true });

  return NextResponse.json({ ingested: ids.length, ids });
}

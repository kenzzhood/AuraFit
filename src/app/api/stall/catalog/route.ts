import { NextResponse } from "next/server";
import { loadCatalog } from "@/stall/catalog-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const catalog = loadCatalog();
  return NextResponse.json({ items: catalog.items, total: catalog.items.length });
}

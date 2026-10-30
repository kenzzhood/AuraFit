import { NextResponse } from "next/server";
import { loadCharacters } from "@/stall/catalog-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const characters = loadCharacters();
  return NextResponse.json({ items: characters.items, total: characters.items.length });
}

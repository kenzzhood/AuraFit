import { NextResponse } from "next/server";
import { applyInbound, readWhatsappConfig } from "@/modules/whatsapp";
import { STORE, getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: unknown; text?: unknown } | null;
  if (!body || typeof body.phone !== "string" || typeof body.text !== "string") {
    return NextResponse.json({ error: "Missing message." }, { status: 400 });
  }
  const world = getWorld();
  const config = readWhatsappConfig();
  const record = applyInbound({
    ledger: world.consents,
    phone: body.phone,
    salt: config.phoneSalt,
    storeId: STORE.id,
    text: body.text,
    now: Date.now(),
    wordingVersion: config.wordingVersion,
  });
  return NextResponse.json({
    consent: { yes: record.yes, stopped: record.stopped, at: record.at },
  });
}

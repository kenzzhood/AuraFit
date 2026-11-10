import { NextResponse } from "next/server";
import { applyInbound, readWhatsappConfig, shareFromText } from "@/modules/whatsapp";
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
  const share = shareFromText(body.text, world.shares);
  const looks = share
    ? share.lookIds
        .map((id) => world.looks.find((look) => look.id === id))
        .filter((look) => look != null)
        .map((look) => ({ id: look.id, name: look.name, image: look.image }))
    : [];
  return NextResponse.json({
    consent: { yes: record.yes, stopped: record.stopped, at: record.at },
    reply: share
      ? looks.length
        ? `Your six looks: ${looks.map((look) => look.name).join(", ")}`
        : `No looks saved for ${share.code}.`
      : record.stopped
        ? "Stopped. We will not message this number."
        : record.yes
          ? "You will hear about new arrivals. Two messages a month at most."
          : "Send your AuraFit code to get the looks.",
    looks,
  });
}

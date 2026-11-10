import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { rememberStyle, openDatabase } from "@/db/client";
import { availabilityText, type AvailabilityLabel } from "@/modules/shared/types";
import { authenticate, readPlatformConfig, recordAudit } from "@/modules/platform";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

const LABELS = new Set(["available", "likely", "ask_staff"]);

async function admin() {
  const jar = await cookies();
  const config = readPlatformConfig();
  const session = authenticate({
    mode: config.mode,
    entraConfigured: config.entraConfigured,
    cookie: jar.get("aurafit_session")?.value ?? null,
    deviceId: null,
    secret: config.secret,
    now: Date.now(),
  });
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const looks = getWorld().looks.map((look) => ({
    id: look.id,
    name: look.name,
    availability: look.availability,
    image: look.image,
  }));
  return NextResponse.json({ looks });
}

export async function POST(request: Request) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; availability?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.availability !== "string" || !LABELS.has(body.availability)) {
    return NextResponse.json({ error: "Missing style." }, { status: 400 });
  }
  const world = getWorld();
  const look = world.looks.find((item) => item.id === body.id);
  if (!look) return NextResponse.json({ error: "Unknown style." }, { status: 404 });
  const availability = body.availability as AvailabilityLabel;
  look.availability = availability;
  look.availabilityText = availabilityText(availability);
  const db = await openDatabase();
  await rememberStyle(db, look.id, availability);
  recordAudit(world.audit, {
    ts: Date.now(),
    action: "catalogue_edit",
    actor: session.id,
    storeId: session.storeId,
    meta: { style: look.id },
  });
  return NextResponse.json({ id: look.id, availability: look.availability });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticate, readPlatformConfig, recordAudit } from "@/modules/platform";
import { markSizeMissing } from "@/modules/runtime/act";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  if (!session || (session.role !== "staff" && session.role !== "owner")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { lookId?: unknown } | null;
  if (!body || typeof body.lookId !== "string") {
    return NextResponse.json({ error: "Missing look." }, { status: 400 });
  }
  const world = getWorld();
  const look = world.looks.find((item) => item.id === body.lookId);
  if (!look) return NextResponse.json({ error: "Look not found." }, { status: 404 });
  markSizeMissing(world, body.lookId);
  recordAudit(world.audit, {
    ts: Date.now(),
    action: "size_missing",
    actor: session.id,
    storeId: session.storeId,
    meta: { lookId: body.lookId },
  });
  return NextResponse.json({ availability: look.availabilityText });
}

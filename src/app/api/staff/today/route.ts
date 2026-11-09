import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PHONE_CHECKLIST } from "@/modules/staff";
import { authenticate, readPlatformConfig } from "@/modules/platform";
import { acceptStaffAlert } from "@/modules/runtime/act";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

async function staff() {
  const jar = await cookies();
  const config = readPlatformConfig();
  return authenticate({
    mode: config.mode,
    entraConfigured: config.entraConfigured,
    cookie: jar.get("aurafit_session")?.value ?? null,
    deviceId: null,
    secret: config.secret,
    now: Date.now(),
  });
}

export async function GET() {
  const session = await staff();
  if (!session || (session.role !== "staff" && session.role !== "owner" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const world = getWorld();
  return NextResponse.json({
    store: world.tenants.find((tenant) => tenant.id === session.storeId)?.name ?? session.storeId,
    alerts: world.alerts,
    checklist: PHONE_CHECKLIST,
  });
}

export async function POST(request: Request) {
  const session = await staff();
  if (!session || (session.role !== "staff" && session.role !== "owner" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Missing alert." }, { status: 400 });
  }
  const alert = acceptStaffAlert(getWorld(), body.id, session.id, Date.now());
  if (!alert) return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  return NextResponse.json({ alert });
}

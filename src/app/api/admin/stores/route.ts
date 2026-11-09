import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { setHeatmap } from "@/modules/admin";
import { authenticate, readPlatformConfig, recordAudit } from "@/modules/platform";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

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
  return NextResponse.json({ tenants: getWorld().tenants });
}

export async function POST(request: Request) {
  const session = await admin();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    storeId?: unknown;
    enabled?: unknown;
    legalSignOff?: unknown;
  } | null;
  if (!body || typeof body.storeId !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Missing store." }, { status: 400 });
  }
  const world = getWorld();
  const tenant = world.tenants.find((item) => item.id === body.storeId);
  if (!tenant) return NextResponse.json({ error: "Unknown store." }, { status: 404 });
  const result = setHeatmap(tenant, body.enabled, body.legalSignOff === true);
  recordAudit(world.audit, {
    ts: Date.now(),
    action: result.ok ? "heatmap_update" : "heatmap_denied",
    actor: session.id,
    storeId: tenant.id,
    meta: { ok: result.ok },
  });
  if (!result.ok) return NextResponse.json(result, { status: 403 });
  return NextResponse.json(result);
}

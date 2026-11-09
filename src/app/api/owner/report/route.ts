import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { triedNotBought } from "@/modules/dashboard";
import { authenticate, readPlatformConfig } from "@/modules/platform";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

export async function GET() {
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
  if (!session || (session.role !== "owner" && session.role !== "admin")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const world = getWorld();
  return NextResponse.json({
    store: world.tenants.find((tenant) => tenant.id === session.storeId)?.name ?? session.storeId,
    report: triedNotBought(world.events),
  });
}

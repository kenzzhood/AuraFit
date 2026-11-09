import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticate, readPlatformConfig, resolveAuthMode, signSession } from "@/modules/platform";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (resolveAuthMode() !== "mock") {
    return NextResponse.json(
      { error: "Microsoft Entra sign-in is not configured on this server." },
      { status: 501 }
    );
  }
  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  const role = body?.role;
  if (role !== "staff" && role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Choose staff, owner or admin." }, { status: 400 });
  }
  const token = signSession(
    {
      role,
      storeId: "anna-nagar",
      id: role === "staff" ? "ravi" : role,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    },
    readPlatformConfig().secret
  );
  const jar = await cookies();
  jar.set("aurafit_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({ ok: true, role });
}

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
  if (!session || session.role === "device") return NextResponse.json({ role: null });
  return NextResponse.json({ role: session.role, storeId: session.storeId });
}

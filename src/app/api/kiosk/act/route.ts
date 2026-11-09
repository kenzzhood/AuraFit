import { NextResponse } from "next/server";
import { act } from "@/modules/runtime/act";
import { getWorld } from "@/modules/runtime/world";
import { resolveAuthMode } from "@/modules/platform";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["boot", "presence", "raiseHand", "choose", "back", "capture", "tick"]);

export async function POST(request: Request) {
  const world = getWorld();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = world.limiter.check(`kiosk:${ip}`, 90, 60_000, Date.now());
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown; action?: { type?: unknown } } | null;
  if (!body?.action || typeof body.action.type !== "string" || !ACTIONS.has(body.action.type)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (body.action.type === "boot") {
    const boot = body.action as { deviceId?: unknown };
    if (typeof boot.deviceId !== "string" || !/^[a-z0-9-]{3,64}$/.test(boot.deviceId)) {
      return NextResponse.json({ error: "Unknown device." }, { status: 400 });
    }
    if (resolveAuthMode() !== "mock") {
      return NextResponse.json(
        { error: "Device sign-in with Microsoft Entra is not configured on this server." },
        { status: 501 }
      );
    }
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const result = act(world, sessionId, body.action as never, Date.now());
  return NextResponse.json(result.view);
}

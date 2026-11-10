import { cookies } from "next/headers";
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
  if (!session || (session.role !== "staff" && session.role !== "owner" && session.role !== "admin")) {
    return new Response("Sign in required.", { status: 401 });
  }
  const payload = JSON.stringify(getWorld().alerts);
  return new Response(`data: ${payload}\n\n`, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
    },
  });
}

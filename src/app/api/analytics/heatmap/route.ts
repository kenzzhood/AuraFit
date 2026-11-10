import { NextResponse } from "next/server";
import { ingestHeatmap, readAnalyticsConfig } from "@/modules/analytics";
import { getWorld } from "@/modules/runtime/world";

export const dynamic = "force-dynamic";

export async function GET() {
  const world = getWorld();
  const tenant = world.tenants.find((item) => item.id === "anna-nagar");
  if (!tenant?.heatmap || !tenant.legalSignOff) {
    return NextResponse.json({ counts: [] });
  }
  return NextResponse.json({ counts: world.zones });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.storeId !== "string") {
    return NextResponse.json({ error: "Missing events." }, { status: 400 });
  }
  const world = getWorld();
  const tenant = world.tenants.find((item) => item.id === body.storeId);
  const result = ingestHeatmap(
    readAnalyticsConfig().enabled && Boolean(tenant?.heatmap),
    Boolean(tenant?.legalSignOff),
    body
  );
  return NextResponse.json(result, { status: result.ok ? 202 : 403 });
}

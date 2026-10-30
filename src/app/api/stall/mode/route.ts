import { NextResponse } from "next/server";
import { readFoundryConfig } from "@/stall/foundry-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const config = readFoundryConfig();
  return NextResponse.json({
    mode: config.live ? "live" : "demo",
    deployment: config.live ? config.deployment : null,
    model: "gpt-image-1",
    provider: "Azure AI Foundry",
  });
}

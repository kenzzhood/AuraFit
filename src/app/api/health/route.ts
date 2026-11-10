import { NextResponse } from "next/server";
import { imageRetirementWarning, readGenerationConfig } from "@/modules/generation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = readGenerationConfig();
  const warning = imageRetirementWarning(new Date());
  if (warning) console.warn(warning);
  return NextResponse.json(
    {
      ok: true,
      service: "aurafit",
      imageModel: {
        id: config.model,
        version: config.version,
        retiresOn: config.retiresOn,
        provider: config.provider,
        warning,
      },
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } }
  );
}

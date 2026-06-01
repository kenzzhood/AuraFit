import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCrawlerHealth } from "@/lib/ecommerce/providers/crawl-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function studioRouteDiagnostics() {
  const manifestPath = path.join(
    process.cwd(),
    ".next/server/app-paths-manifest.json"
  );
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<
      string,
      string
    >;
    const studioPages = Object.keys(manifest).filter((route) =>
      /^\/(generate|wardrobe|chat|onboarding|dashboard|my-posts|outfits)/.test(
        route
      )
    );
    const generatePage = path.join(
      process.cwd(),
      ".next/server/app/generate/page.js"
    );
    return {
      studioPages,
      generatePageExists: fs.existsSync(generatePage),
    };
  } catch {
    return { studioPages: [], generatePageExists: false };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const warm = url.searchParams.get("warm") === "1";
  const debug = url.searchParams.get("debug") === "1";

  if (debug) {
    return NextResponse.json(
      {
        ok: true,
        service: "aurafit-web",
        diagnostics: studioRouteDiagnostics(),
        time: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  }

  if (!warm) {
    return NextResponse.json(
      {
        ok: true,
        service: "aurafit-web",
        time: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  }

  const checks: Record<string, boolean | string> = {
    web: true,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (e) {
    checks.database = e instanceof Error ? e.message : "unavailable";
  }

  try {
    checks.crawler = await checkCrawlerHealth();
  } catch (e) {
    checks.crawler = e instanceof Error ? e.message : "unavailable";
  }

  const ok =
    checks.database === true &&
    (checks.crawler === true || checks.crawler === false);

  return NextResponse.json(
    {
      ok,
      service: "aurafit-web",
      warmed: true,
      checks,
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}

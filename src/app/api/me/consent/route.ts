import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAppUser } from "@/lib/api/require-user";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/redis";

const bodySchema = z.object({
  accepted: z.boolean(),
});

function hashIp(forwarded: string | null): string | null {
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim();
  if (!first) return null;
  return createHash("sha256").update(first).digest("hex");
}

export async function POST(req: Request) {
  const authz = await requireAppUser();
  if (!authz.ok) return authz.response;

  const lim = await rateLimit(`consent:${authz.user.id}`, 30, 3600);
  if (!lim.ok) {
    return rateLimitedResponse("consent", lim.retryAfterSec);
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ua = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const ipHash = hashIp(req.headers.get("x-forwarded-for"));

  await prisma.consentRecord.create({
    data: {
      userId: authz.user.id,
      document: "analytics",
      version: "1",
      accepted: parsed.data.accepted,
      userAgent: ua,
      ipHash,
    },
  });

  return NextResponse.json({ ok: true });
}

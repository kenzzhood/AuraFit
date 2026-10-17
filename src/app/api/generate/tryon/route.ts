import { NextResponse } from "next/server";
import { z } from "zod";
import { requestVirtualTryOnGrid } from "@/lib/ai/tryon";
import { withCors, optionsResponse } from "@/lib/api/cors";
import { requireAppUser } from "@/lib/api/require-user";
import { assertAllowedUserMediaUrl } from "@/lib/security/ssrf";
import { assertSafeExternalUrl } from "@/lib/security/ssrf";
import { rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

const schema = z.object({
  personImageUrl: z.string().url(),
  garmentImageUrl: z.string().url(),
});

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const authz = await requireAppUser();
  if (!authz.ok) return withCors(authz.response, origin);

  const lim = await rateLimit(`tryon:${authz.user.id}`, 12, 15 * 60);
  if (!lim.ok) {
    return withCors(rateLimitedResponse("tryon", lim.retryAfterSec), origin);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  try {
    assertAllowedUserMediaUrl(parsed.data.personImageUrl);
    assertSafeExternalUrl(parsed.data.garmentImageUrl);
  } catch {
    return withCors(
      NextResponse.json({ error: "Invalid image URL" }, { status: 400 }),
      origin
    );
  }

  const result = await requestVirtualTryOnGrid({
    personImageUrl: parsed.data.personImageUrl,
    garmentImageUrls: [parsed.data.garmentImageUrl],
  });

  return withCors(NextResponse.json(result), origin);
}

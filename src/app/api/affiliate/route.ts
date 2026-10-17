import { NextResponse } from "next/server";
import { affiliateSchema } from "@/types/api";
import { recordAffiliateClick } from "@/lib/ecommerce/affiliate";
import { requireAppUser } from "@/lib/api/require-user";
import { rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

export async function POST(req: Request) {
  const authz = await requireAppUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const lim = await rateLimit(`affiliate:${user.id}`, 40, 15 * 60);
  if (!lim.ok) {
    return rateLimitedResponse("affiliate", lim.retryAfterSec);
  }

  const parsed = affiliateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { redirectUrl } = await recordAffiliateClick({
      userId: user.id,
      outfitId: parsed.data.outfitId,
      source: parsed.data.source,
      targetUrl: parsed.data.targetUrl,
      productCacheId: parsed.data.productCacheId,
    });
    return NextResponse.json({ redirectUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid affiliate URL" },
      { status: 400 }
    );
  }
}

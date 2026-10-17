import { NextResponse } from "next/server";
import { discoverProducts } from "@/lib/ecommerce/discovery";
import { productToNormalized } from "@/lib/ecommerce/product";
import { requireAppUser } from "@/lib/api/require-user";
import { SEARCH_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

export async function GET(req: Request) {
  const authz = await requireAppUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const lim = await rateLimit(
    `search:${user.id}`,
    SEARCH_RATE_LIMIT.limit,
    SEARCH_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("search", lim.retryAfterSec);
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const region = (searchParams.get("region") as "IN" | "US" | "UK") ?? "IN";

  const result = await discoverProducts({
    query: {
      query,
      category: searchParams.get("category") ?? "top",
      region,
    },
    userId: user.id,
  });

  return NextResponse.json({
    products: result.products.map((p) => productToNormalized(p)),
    sessionId: result.sessionId,
    status: result.status,
    providerMeta: result.providerMeta,
  });
}

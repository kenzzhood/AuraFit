import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { discoverProducts } from "@/lib/ecommerce/discovery";
import { productToNormalized } from "@/lib/ecommerce/product";
import { ensureAppUser } from "@/lib/user";
import { SEARCH_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

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
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const result = await discoverProducts({
    query: {
      query,
      category: searchParams.get("category") ?? "outfit",
      region,
      budgetMin: searchParams.get("budgetMin")
        ? Number(searchParams.get("budgetMin"))
        : undefined,
      budgetMax: searchParams.get("budgetMax")
        ? Number(searchParams.get("budgetMax"))
        : undefined,
    },
    userId: user.id,
    allowAsyncCrawl: !sessionId,
  });

  return NextResponse.json({
    products: result.products.map((p) => productToNormalized(p)),
    sessionId: result.sessionId,
    status: result.status,
    providerMeta: result.providerMeta,
  });
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAppUser } from "@/lib/user";
import { startCheckout } from "@/lib/billing/checkout";
import { CHECKOUT_UNAVAILABLE_MESSAGE } from "@/lib/billing/config";
import { BILLING_CHECKOUT_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

const schema = z.object({
  catalogKey: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

  const lim = await rateLimit(
    `billing:checkout:${user.id}`,
    BILLING_CHECKOUT_RATE_LIMIT.limit,
    BILLING_CHECKOUT_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("billing", lim.retryAfterSec);
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await startCheckout({
      userId: user.id,
      catalogKey: parsed.data.catalogKey,
      customer: {
        email: cu?.primaryEmailAddress?.emailAddress ?? undefined,
        name: cu?.fullName ?? undefined,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    const status =
      msg === CHECKOUT_UNAVAILABLE_MESSAGE || msg.includes("gated") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

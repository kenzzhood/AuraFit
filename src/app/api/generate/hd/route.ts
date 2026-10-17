import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAppUser } from "@/lib/user";
import { createHdRenderJob } from "@/lib/jobs/hd-render";
import { withCors, optionsResponse } from "@/lib/api/cors";
import {
  EntitlementError,
  assertCanHdRender,
  finalizeUsage,
} from "@/lib/billing/entitlements";
import { HD_RENDER_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

const schema = z.object({
  jobId: z.string(),
  lookIndex: z.number().int().min(0).max(5).optional(),
  userPhotoUrl: z.string().url().optional(),
});

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const { userId } = await auth();
  if (!userId) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      origin
    );
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );

  const lim = await rateLimit(
    `hd:${user.id}`,
    HD_RENDER_RATE_LIMIT.limit,
    HD_RENDER_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return withCors(
      rateLimitedResponse("hd", lim.retryAfterSec),
      origin
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  let reservationId: string | null = null;
  try {
    const entitlement = await assertCanHdRender(user.id);
    reservationId = entitlement.reservationId;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return withCors(
        NextResponse.json({ error: e.message, code: e.code }, { status: 402 }),
        origin
      );
    }
    throw e;
  }

  try {
    const hdJobId = await createHdRenderJob({
      userId: user.id,
      parentJobId: parsed.data.jobId,
      lookIndex: parsed.data.lookIndex,
    });
    await finalizeUsage(reservationId, true, hdJobId);
    return withCors(NextResponse.json({ jobId: hdJobId }), origin);
  } catch (e) {
    await finalizeUsage(reservationId, false);
    return withCors(
      NextResponse.json(
        { error: e instanceof Error ? e.message : "HD render failed" },
        { status: 500 }
      ),
      origin
    );
  }
}

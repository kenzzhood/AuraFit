import { NextResponse } from "next/server";
import { z } from "zod";
import { replaceLookProduct } from "@/lib/jobs/regenerate";
import { withCors, optionsResponse } from "@/lib/api/cors";
import { requireAppUser } from "@/lib/api/require-user";
import { isAllowedAffiliateUrl } from "@/lib/security/affiliate-url";
import { assertSafeExternalUrl } from "@/lib/security/ssrf";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/redis";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";

const schema = z.object({
  jobId: z.string(),
  lookIndex: z.number().int().min(0).max(5),
  currentProductUrl: z.string().url().optional(),
  /** Prefer server-side product cache id over client-crafted URLs. */
  productCacheId: z.string().optional(),
  replacement: z
    .object({
      externalId: z.string().optional(),
      title: z.string().min(1),
      productUrl: z.string().url(),
      source: z.string().min(1),
      price: z.number().optional(),
      currency: z.string().optional(),
      imageUrl: z.string().url().optional(),
      storeName: z.string().optional(),
      canonicalUrl: z.string().url().optional(),
      availability: z.enum(["in_stock", "out_of_stock", "unknown"]).optional(),
      matchCategory: z.string().optional(),
    })
    .optional(),
});

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const authz = await requireAppUser();
  if (!authz.ok) return withCors(authz.response, origin);
  const user = authz.user;

  const lim = await rateLimit(`replace:${user.id}`, 30, 15 * 60);
  if (!lim.ok) {
    return withCors(rateLimitedResponse("replace-item", lim.retryAfterSec), origin);
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  let replacement = parsed.data.replacement;

  if (parsed.data.productCacheId) {
    const cached = await prisma.productCache.findUnique({
      where: { id: parsed.data.productCacheId },
    });
    if (!cached?.productUrl) {
      return withCors(
        NextResponse.json({ error: "Product not found" }, { status: 404 }),
        origin
      );
    }
    if (!isAllowedAffiliateUrl(cached.productUrl)) {
      return withCors(
        NextResponse.json({ error: "Product URL not allowed" }, { status: 400 }),
        origin
      );
    }
    replacement = {
      externalId: cached.externalId,
      title: cached.title,
      productUrl: cached.productUrl,
      source: cached.source,
      price: cached.price ?? undefined,
      currency: cached.currency ?? undefined,
      imageUrl: cached.imageUrl ?? undefined,
      matchCategory: cached.category ?? undefined,
    };
  }

  if (!replacement) {
    return withCors(
      NextResponse.json(
        { error: "productCacheId or replacement required" },
        { status: 400 }
      ),
      origin
    );
  }

  if (!isAllowedAffiliateUrl(replacement.productUrl)) {
    return withCors(
      NextResponse.json(
        { error: "replacement.productUrl must be an https retailer URL" },
        { status: 400 }
      ),
      origin
    );
  }
  if (replacement.imageUrl) {
    try {
      assertSafeExternalUrl(replacement.imageUrl);
    } catch {
      return withCors(
        NextResponse.json({ error: "Invalid replacement.imageUrl" }, { status: 400 }),
        origin
      );
    }
  }

  try {
    const { look } = await replaceLookProduct({
      userId: user.id,
      jobId: parsed.data.jobId,
      lookIndex: parsed.data.lookIndex,
      currentProductUrl: parsed.data.currentProductUrl,
      replacement,
    });
    return withCors(NextResponse.json({ look }), origin);
  } catch (e) {
    return withCors(
      NextResponse.json(
        { error: e instanceof Error ? e.message : "Replace failed" },
        { status: 400 }
      ),
      origin
    );
  }
}

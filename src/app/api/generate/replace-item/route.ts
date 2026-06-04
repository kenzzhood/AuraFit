import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAppUser } from "@/lib/user";
import { replaceLookProduct } from "@/lib/jobs/regenerate";
import { withCors, optionsResponse } from "@/lib/api/cors";

const schema = z.object({
  jobId: z.string(),
  lookIndex: z.number().int().min(0).max(5),
  currentProductUrl: z.string().url().optional(),
  replacement: z.object({
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
  }),
});

export async function OPTIONS(req: Request) {
  return optionsResponse(req.headers.get("origin"));
}

/**
 * Replace one product in a look with another real candidate (typically picked
 * from the slot's cached candidate list via GET /api/products/session/[id]).
 */
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

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
      origin
    );
  }

  try {
    const { look } = await replaceLookProduct({
      userId: user.id,
      jobId: parsed.data.jobId,
      lookIndex: parsed.data.lookIndex,
      currentProductUrl: parsed.data.currentProductUrl,
      replacement: parsed.data.replacement,
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

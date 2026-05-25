import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { affiliateSchema } from "@/types/api";
import { ensureAppUser } from "@/lib/user";
import { recordAffiliateClick } from "@/lib/ecommerce/affiliate";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = affiliateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { redirectUrl } = await recordAffiliateClick({
    userId: user.id,
    outfitId: parsed.data.outfitId,
    source: parsed.data.source,
    targetUrl: parsed.data.targetUrl,
    productCacheId: parsed.data.productCacheId,
  });

  return NextResponse.json({ redirectUrl });
}

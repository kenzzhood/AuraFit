import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import { addItemsToCart } from "@/lib/cart/service";
import { rateLimit, CART_WRITE_RATE_LIMIT } from "@/lib/redis";
import { addCartItemBodySchema } from "@/types/cart";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const rl = await rateLimit(
    `cart:write:${user.id}`,
    CART_WRITE_RATE_LIMIT.limit,
    CART_WRITE_RATE_LIMIT.windowSec
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many cart updates. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  const parsed = addCartItemBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  let inputs;

  if (body.type === "item") {
    inputs = [body.item];
  } else {
    inputs = body.lookProducts.map((p) => ({
      ...p,
      outfitId: p.outfitId ?? body.outfitId,
      outfitLabel: p.outfitLabel ?? body.outfitLabel,
    }));
  }

  const cart = await addItemsToCart(user.id, inputs);
  return NextResponse.json(cart);
}

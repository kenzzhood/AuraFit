import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import {
  buildCheckoutResponse,
  getOrCreateCart,
} from "@/lib/cart/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const cart = await getOrCreateCart(user.id);
  if (cart.items.length === 0) {
    return NextResponse.json({
      itemCount: 0,
      subtotal: 0,
      currency: "INR",
      groups: [],
    });
  }

  const checkout = buildCheckoutResponse(cart.items);

  await prisma.analyticsEvent.create({
    data: {
      userId: user.id,
      eventType: "checkout_initiated",
      properties: {
        item_count: checkout.itemCount,
        retailer_count: checkout.groups.length,
        subtotal: checkout.subtotal,
      },
    },
  });

  return NextResponse.json(checkout);
}

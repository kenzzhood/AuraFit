import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import { buildCartResponse } from "@/lib/cart/service";
import { prisma } from "@/lib/prisma";
import { patchCartItemSchema } from "@/types/cart";

type RouteParams = { params: Promise<{ id: string }> };

async function getOwnedItem(itemId: string, appUserId: string) {
  return prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId: appUserId } },
    include: { cart: true },
  });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const { id } = await params;
  const item = await getOwnedItem(id, user.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cartItem.delete({ where: { id } });
  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: item.cartId },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });

  return NextResponse.json(buildCartResponse(cart.id, cart.items));
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);

  const parsed = patchCartItemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const item = await getOwnedItem(id, user.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cartItem.update({
    where: { id },
    data: { quantity: parsed.data.quantity },
  });

  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: item.cartId },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });

  return NextResponse.json(buildCartResponse(cart.id, cart.items));
}

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/user";
import { getOrCreateBillingAccount } from "@/lib/billing/account";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/billing/catalog";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cu = await currentUser();
  const user = await ensureAppUser(
    userId,
    cu?.primaryEmailAddress?.emailAddress
  );
  const account = await getOrCreateBillingAccount(user.id);
  const rows = await prisma.paymentTransaction.findMany({
    where: { billingAccountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    transactions: rows.map((t) => ({
      id: t.id,
      catalogKey: t.catalogKey,
      kind: t.kind,
      status: t.status,
      amount: formatMoney(t.amountMinor, t.currency),
      currency: t.currency,
      createdAt: t.createdAt,
    })),
  });
}

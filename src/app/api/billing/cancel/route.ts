import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { DeletedUserError, ensureAppUser } from "@/lib/user";
import { getOrCreateBillingAccount, auditBilling } from "@/lib/billing/account";
import { cancelRazorpaySubscription } from "@/lib/billing/razorpay";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cu = await currentUser();
    const user = await ensureAppUser(
      userId,
      cu?.primaryEmailAddress?.emailAddress
    );
    const account = await getOrCreateBillingAccount(user.id);

    const activeSubs = await prisma.subscription.findMany({
      where: {
        billingAccountId: account.id,
        status: { in: ["ACTIVE", "PAST_DUE", "CREATED"] },
        provider: "RAZORPAY",
      },
      select: { id: true, providerSubscriptionId: true },
    });

    for (const sub of activeSubs) {
      try {
        await cancelRazorpaySubscription(sub.providerSubscriptionId, true);
      } catch (e) {
        console.error(
          `Razorpay cancel failed for subscription ${sub.providerSubscriptionId}:`,
          e
        );
      }
    }

    await prisma.billingAccount.update({
      where: { id: account.id },
      data: { cancelAtPeriodEnd: true },
    });
    await prisma.subscription.updateMany({
      where: {
        billingAccountId: account.id,
        status: { in: ["ACTIVE", "PAST_DUE", "CREATED"] },
      },
      data: { cancelAtPeriodEnd: true },
    });
    await auditBilling({
      billingAccountId: account.id,
      actor: user.id,
      action: "cancel_at_period_end",
    });

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: true,
      periodEnd: account.currentPeriodEnd,
    });
  } catch (e) {
    if (e instanceof DeletedUserError) {
      return NextResponse.json(
        { error: "Account has been deleted" },
        { status: 403 }
      );
    }
    throw e;
  }
}

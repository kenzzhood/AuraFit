import {
  BillingProvider,
  PaymentKind,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateBillingAccount, auditBilling } from "./account";
import { getCatalogItem } from "./catalog";
import { assertCheckoutAllowed } from "./config";
import {
  createPaymentLink,
  createSubscriptionCheckout,
} from "./razorpay";

export async function startCheckout(params: {
  userId: string;
  catalogKey: string;
  customer?: { name?: string; email?: string; contact?: string };
}): Promise<{ checkoutUrl: string; transactionId: string }> {
  assertCheckoutAllowed();
  const item = getCatalogItem(params.catalogKey);
  if (!item || item.key === "free" || item.amountMinor <= 0) {
    throw new Error("Invalid catalog item for checkout");
  }

  const account = await getOrCreateBillingAccount(params.userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const callbackUrl = `${appUrl}/billing/result`;

  const notes = {
    billingAccountId: account.id,
    catalogKey: item.key,
    userId: params.userId,
  };

  const kind =
    item.kind === "subscription"
      ? PaymentKind.SUBSCRIPTION
      : PaymentKind.CREDIT_PACK;

  let checkoutUrl: string;
  let providerOrderId: string;

  if (item.kind === "subscription") {
    const result = await createSubscriptionCheckout({
      item,
      customer: params.customer ?? {},
      notes,
      totalCount: item.interval === "year" ? 10 : 12,
      callbackUrl,
    });
    if ("subscriptionId" in result) {
      checkoutUrl = result.shortUrl;
      providerOrderId = result.subscriptionId;
    } else {
      checkoutUrl = result.shortUrl;
      providerOrderId = result.id;
    }
  } else {
    const link = await createPaymentLink({
      item,
      receipt: `af_${account.id.slice(0, 8)}_${Date.now()}`,
      customer: params.customer ?? {},
      notes,
      callbackUrl,
    });
    checkoutUrl = link.shortUrl;
    providerOrderId = link.id;
  }

  const tx = await prisma.paymentTransaction.create({
    data: {
      billingAccountId: account.id,
      provider: BillingProvider.RAZORPAY,
      providerOrderId,
      catalogKey: item.key,
      kind,
      status: PaymentStatus.PENDING,
      amountMinor: item.amountMinor,
      currency: item.currency,
      creditsGranted: item.boards ?? 0,
    },
  });

  await auditBilling({
    billingAccountId: account.id,
    actor: params.userId,
    action: "checkout_started",
    metadata: { catalogKey: item.key, transactionId: tx.id },
  });

  return { checkoutUrl, transactionId: tx.id };
}

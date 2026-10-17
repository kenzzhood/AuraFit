import {
  BillingInterval,
  BillingProvider,
  BillingStatus,
  CreditKind,
  PaymentKind,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCatalogItem } from "./catalog";
import { auditBilling } from "./account";

function intervalFromCatalog(
  interval?: "month" | "year"
): BillingInterval {
  if (interval === "year") return BillingInterval.YEAR;
  if (interval === "month") return BillingInterval.MONTH;
  return BillingInterval.ONE_TIME;
}

function periodEnd(interval?: "month" | "year", from = new Date()): Date {
  const d = new Date(from);
  if (interval === "year") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

/**
 * Idempotent fulfillment after verified payment (webhook only).
 * Locked on providerPaymentId so dual Razorpay events cannot double-grant.
 */
export async function fulfillCapturedPayment(params: {
  billingAccountId: string;
  catalogKey: string;
  providerPaymentId: string;
  providerOrderId?: string | null;
  amountMinor: number;
  currency: string;
  raw?: unknown;
}): Promise<{ alreadyFulfilled: boolean }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`razorpay_pay:${params.providerPaymentId}`})
      )
    `;

    const existing = await tx.paymentTransaction.findUnique({
      where: {
        provider_providerPaymentId: {
          provider: BillingProvider.RAZORPAY,
          providerPaymentId: params.providerPaymentId,
        },
      },
    });
    if (existing?.status === PaymentStatus.CAPTURED) {
      return { alreadyFulfilled: true };
    }

    // Prefer binding to the PENDING checkout row created server-side.
    let pending =
      params.providerOrderId != null
        ? await tx.paymentTransaction.findFirst({
            where: {
              provider: BillingProvider.RAZORPAY,
              providerOrderId: params.providerOrderId,
              status: PaymentStatus.PENDING,
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    // Payment links store link id as providerOrderId at checkout.
    if (!pending && params.providerOrderId) {
      pending = await tx.paymentTransaction.findFirst({
        where: {
          provider: BillingProvider.RAZORPAY,
          providerOrderId: params.providerOrderId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.CREATED] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const billingAccountId =
      pending?.billingAccountId ?? params.billingAccountId;
    const catalogKey = pending?.catalogKey ?? params.catalogKey;

    if (pending) {
      if (pending.billingAccountId !== params.billingAccountId) {
        // Notes may be wrong — trust the server PENDING row.
      }
      if (
        pending.amountMinor !== params.amountMinor ||
        pending.currency !== params.currency
      ) {
        throw new Error(
          `Checkout amount mismatch for order ${params.providerOrderId}`
        );
      }
    }

    const item = getCatalogItem(catalogKey);
    if (!item) {
      throw new Error(`Unknown catalog key: ${catalogKey}`);
    }

    if (
      item.amountMinor !== params.amountMinor ||
      item.currency !== params.currency
    ) {
      throw new Error(
        `Amount/currency mismatch for ${catalogKey}: expected ${item.amountMinor} ${item.currency}, got ${params.amountMinor} ${params.currency}`
      );
    }

    const kind =
      item.kind === "subscription"
        ? PaymentKind.SUBSCRIPTION
        : PaymentKind.CREDIT_PACK;

    const paymentTx = pending
      ? await tx.paymentTransaction.update({
          where: { id: pending.id },
          data: {
            providerPaymentId: params.providerPaymentId,
            status: PaymentStatus.CAPTURED,
            catalogKey,
            kind,
            creditsGranted: item.boards ?? 0,
            creditKind:
              item.kind === "credit_pack"
                ? CreditKind.STANDARD_BOARD
                : undefined,
            raw: params.raw as object | undefined,
          },
        })
      : await tx.paymentTransaction.create({
          data: {
            billingAccountId,
            provider: BillingProvider.RAZORPAY,
            providerPaymentId: params.providerPaymentId,
            providerOrderId: params.providerOrderId ?? undefined,
            catalogKey,
            kind,
            status: PaymentStatus.CAPTURED,
            amountMinor: params.amountMinor,
            currency: params.currency,
            creditsGranted: item.boards ?? 0,
            creditKind:
              item.kind === "credit_pack"
                ? CreditKind.STANDARD_BOARD
                : undefined,
            raw: params.raw as object | undefined,
          },
        });

    // Grants run after commit via outer call — keep credit grant inside same
    // advisory lock by calling grantCredits outside nested advisory would
    // deadlock. Use inline ledger write here instead.
    if (item.kind === "credit_pack" && (item.boards ?? 0) > 0) {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`billing_ledger:${billingAccountId}:${CreditKind.STANDARD_BOARD}`})
        )
      `;
      const already = await tx.creditLedgerEntry.findFirst({
        where: {
          reason: "credit_pack_purchase",
          referenceId: paymentTx.id,
          delta: { gt: 0 },
        },
      });
      if (!already) {
        const last = await tx.creditLedgerEntry.findFirst({
          where: {
            billingAccountId,
            kind: CreditKind.STANDARD_BOARD,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        const balanceAfter = (last?.balanceAfter ?? 0) + item.boards!;
        await tx.creditLedgerEntry.create({
          data: {
            billingAccountId,
            kind: CreditKind.STANDARD_BOARD,
            delta: item.boards!,
            balanceAfter,
            reason: "credit_pack_purchase",
            referenceId: paymentTx.id,
            metadata: { catalogKey },
          },
        });
      }
    }

    if (item.kind === "subscription" && item.tier && item.tier !== "free") {
      const start = new Date();
      const end = periodEnd(item.interval, start);
      await tx.billingAccount.update({
        where: { id: billingAccountId },
        data: {
          planKey: catalogKey,
          status: BillingStatus.ACTIVE,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
      });

      const subId = `paylink_${params.providerPaymentId}`;
      const existingSub = await tx.subscription.findUnique({
        where: { providerSubscriptionId: subId },
      });
      if (!existingSub) {
        await tx.subscription.create({
          data: {
            billingAccountId,
            provider: BillingProvider.RAZORPAY,
            providerSubscriptionId: subId,
            planKey: catalogKey,
            status: SubscriptionStatus.ACTIVE,
            amountMinor: params.amountMinor,
            currency: params.currency,
            interval: intervalFromCatalog(item.interval),
            currentPeriodStart: start,
            currentPeriodEnd: end,
            raw: params.raw as object | undefined,
          },
        });
      }
    }

    await tx.billingAuditLog.create({
      data: {
        billingAccountId,
        actor: "razorpay_webhook",
        action: "payment_fulfilled",
        metadata: {
          catalogKey,
          providerPaymentId: params.providerPaymentId,
          transactionId: paymentTx.id,
        },
      },
    });

    return { alreadyFulfilled: false };
  });
}

export async function markSubscriptionCanceled(params: {
  billingAccountId: string;
  providerSubscriptionId: string;
}): Promise<void> {
  await prisma.subscription.updateMany({
    where: {
      billingAccountId: params.billingAccountId,
      providerSubscriptionId: params.providerSubscriptionId,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
      cancelAtPeriodEnd: true,
    },
  });
  await prisma.billingAccount.update({
    where: { id: params.billingAccountId },
    data: { cancelAtPeriodEnd: true },
  });
  await auditBilling({
    billingAccountId: params.billingAccountId,
    actor: "system",
    action: "subscription_cancel_scheduled",
    metadata: { providerSubscriptionId: params.providerSubscriptionId },
  });
}

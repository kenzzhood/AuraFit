import { BillingStatus } from "@prisma/client";
import type { BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trialDays } from "./catalog";

export async function auditBilling(params: {
  billingAccountId?: string | null;
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.billingAuditLog.create({
    data: {
      billingAccountId: params.billingAccountId ?? undefined,
      actor: params.actor,
      action: params.action,
      metadata: params.metadata as object | undefined,
    },
  });
}

/**
 * Creates a billing account. New users get a card-free Plus trial
 * (BILLING_TRIAL_DAYS, default 7) then fall back to Free when the period ends.
 */
export async function getOrCreateBillingAccount(
  userId: string
): Promise<BillingAccount> {
  const existing = await prisma.billingAccount.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const days = trialDays();
  const now = new Date();

  if (days > 0) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + days);
    const account = await prisma.billingAccount.create({
      data: {
        userId,
        planKey: "plus_month_inr",
        status: BillingStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        // Trial is local — not a Razorpay subscription; no auto-charge.
        cancelAtPeriodEnd: true,
      },
    });
    await auditBilling({
      billingAccountId: account.id,
      actor: userId,
      action: "trial_started",
      metadata: { days, planKey: "plus_month_inr", endsAt: end.toISOString() },
    });
    await prisma.entitlement.upsert({
      where: {
        billingAccountId_key: {
          billingAccountId: account.id,
          key: "trial",
        },
      },
      create: {
        billingAccountId: account.id,
        key: "trial",
        value: { active: true, endsAt: end.toISOString() },
        source: "signup_trial",
        expiresAt: end,
      },
      update: {
        value: { active: true, endsAt: end.toISOString() },
        expiresAt: end,
        source: "signup_trial",
      },
    });
    return account;
  }

  return prisma.billingAccount.create({
    data: {
      userId,
      planKey: "free",
    },
  });
}

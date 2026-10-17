import { BillingStatus, CreditKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "./config";
import { getOrCreateBillingAccount } from "./account";
import { planQuotas } from "./catalog";
import {
  EntitlementError,
  captureReservation,
  getCreditBalance,
  releaseReservation,
  reserveUsage,
} from "./ledger";

export type EntitlementSnapshot = {
  billingEnabled: boolean;
  planKey: string;
  tier: string;
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** True while card-free signup trial is still active. */
  onTrial: boolean;
  boards: {
    planAllowance: number;
    planUsed: number;
    planRemaining: number;
    creditBalance: number;
    available: number;
  };
  hd: {
    planAllowance: number;
    planUsed: number;
    planRemaining: number;
    creditBalance: number;
    available: number;
  };
  wardrobeLimit: number;
  chatMessagesPerDay: number;
};

function periodKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Paid catalog keys only apply while status is ACTIVE and period has not ended.
 * Expired / canceled / past-due accounts fall back to free quotas.
 */
export async function resolveEffectivePlanKey(account: {
  id: string;
  planKey: string;
  status: BillingStatus;
  currentPeriodEnd: Date | null;
}): Promise<string> {
  if (account.planKey === "free") return "free";
  const now = new Date();
  const periodOk =
    !account.currentPeriodEnd || account.currentPeriodEnd.getTime() > now.getTime();
  const statusOk = account.status === BillingStatus.ACTIVE;
  if (statusOk && periodOk) return account.planKey;

  // Lazy downgrade so cancel/expiry sticks.
  if (account.planKey !== "free") {
    await prisma.billingAccount
      .update({
        where: { id: account.id },
        data: {
          planKey: "free",
          status:
            account.status === BillingStatus.ACTIVE
              ? BillingStatus.CANCELED
              : account.status,
        },
      })
      .catch(() => undefined);
  }
  return "free";
}

async function getCounter(
  billingAccountId: string,
  key: string
): Promise<number> {
  const row = await prisma.entitlement.findUnique({
    where: { billingAccountId_key: { billingAccountId, key } },
  });
  if (!row) return 0;
  const value = row.value as { count?: number };
  return typeof value.count === "number" ? value.count : 0;
}

async function decrementCounter(
  billingAccountId: string,
  key: string,
  by = 1
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`entitlement:${billingAccountId}:${key}`}))
    `;
    const row = await tx.entitlement.findUnique({
      where: { billingAccountId_key: { billingAccountId, key } },
    });
    const current =
      typeof (row?.value as { count?: number } | undefined)?.count === "number"
        ? (row!.value as { count: number }).count
        : 0;
    const next = Math.max(0, current - by);
    await tx.entitlement.upsert({
      where: { billingAccountId_key: { billingAccountId, key } },
      create: {
        billingAccountId,
        key,
        value: { count: next },
        source: "usage",
      },
      update: {
        value: { count: next },
        source: "usage",
      },
    });
  });
}

export async function getEntitlementSnapshot(
  userId: string
): Promise<EntitlementSnapshot> {
  if (!isBillingEnabled()) {
    const quotas = planQuotas("free");
    return {
      billingEnabled: false,
      planKey: "free",
      tier: quotas.tier,
      status: BillingStatus.ACTIVE,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      onTrial: false,
      boards: {
        planAllowance: quotas.boards,
        planUsed: 0,
        planRemaining: quotas.boards,
        creditBalance: 0,
        available: quotas.boards,
      },
      hd: {
        planAllowance: quotas.hdRenders,
        planUsed: 0,
        planRemaining: quotas.hdRenders,
        creditBalance: 0,
        available: quotas.hdRenders,
      },
      wardrobeLimit: quotas.wardrobeLimit,
      chatMessagesPerDay: quotas.chatMessagesPerDay,
    };
  }

  const account = await getOrCreateBillingAccount(userId);
  const effectiveKey = await resolveEffectivePlanKey(account);
  const quotas = planQuotas(effectiveKey);
  const pk = periodKey();
  const boardUsed = await getCounter(account.id, `usage:board:${pk}`);
  const hdUsed = await getCounter(account.id, `usage:hd:${pk}`);
  const boardCredits = await getCreditBalance(
    account.id,
    CreditKind.STANDARD_BOARD
  );
  const hdCredits = await getCreditBalance(account.id, CreditKind.HD_RENDER);

  const boardPlanRemaining = Math.max(0, quotas.boards - boardUsed);
  const hdPlanRemaining = Math.max(0, quotas.hdRenders - hdUsed);

  const trialRow = await prisma.entitlement.findUnique({
    where: {
      billingAccountId_key: { billingAccountId: account.id, key: "trial" },
    },
  });
  const onTrial =
    Boolean(trialRow?.expiresAt && trialRow.expiresAt.getTime() > Date.now()) &&
    effectiveKey !== "free" &&
    account.cancelAtPeriodEnd;

  return {
    billingEnabled: isBillingEnabled(),
    planKey: effectiveKey,
    tier: quotas.tier,
    status: account.status,
    periodEnd: account.currentPeriodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    onTrial,
    boards: {
      planAllowance: quotas.boards,
      planUsed: boardUsed,
      planRemaining: boardPlanRemaining,
      creditBalance: boardCredits,
      available: boardPlanRemaining + boardCredits,
    },
    hd: {
      planAllowance: quotas.hdRenders,
      planUsed: hdUsed,
      planRemaining: hdPlanRemaining,
      creditBalance: hdCredits,
      available: hdPlanRemaining + hdCredits,
    },
    wardrobeLimit: quotas.wardrobeLimit,
    chatMessagesPerDay: quotas.chatMessagesPerDay,
  };
}

export async function assertCanGenerate(
  userId: string,
  options?: { previewOnly?: boolean }
): Promise<{ reservationId: string | null; billingAccountId: string }> {
  if (options?.previewOnly || !isBillingEnabled()) {
    return { reservationId: null, billingAccountId: "" };
  }

  const account = await getOrCreateBillingAccount(userId);

  const effectiveKey = await resolveEffectivePlanKey(account);
  const quotas = planQuotas(effectiveKey);
  const pk = periodKey();
  const counterKey = `usage:board:${pk}`;

  const { reservationId } = await reserveUsage({
    billingAccountId: account.id,
    kind: CreditKind.STANDARD_BOARD,
    planAllowance: quotas.boards,
    planCounterKey: counterKey,
  });

  return { reservationId, billingAccountId: account.id };
}

export async function assertCanHdRender(
  userId: string
): Promise<{ reservationId: string | null; billingAccountId: string }> {
  if (!isBillingEnabled()) {
    return { reservationId: null, billingAccountId: "" };
  }

  const account = await getOrCreateBillingAccount(userId);
  const effectiveKey = await resolveEffectivePlanKey(account);
  const quotas = planQuotas(effectiveKey);
  const pk = periodKey();
  const counterKey = `usage:hd:${pk}`;

  const { reservationId } = await reserveUsage({
    billingAccountId: account.id,
    kind: CreditKind.HD_RENDER,
    planAllowance: quotas.hdRenders,
    planCounterKey: counterKey,
  });

  return { reservationId, billingAccountId: account.id };
}

export async function assertCanChat(userId: string): Promise<void> {
  if (!isBillingEnabled()) return;
  const snap = await getEntitlementSnapshot(userId);
  const key = `usage:chat:${new Date().toISOString().slice(0, 10)}`;
  const account = await getOrCreateBillingAccount(userId);
  const used = await getCounter(account.id, key);
  if (used >= snap.chatMessagesPerDay) {
    throw new EntitlementError(
      "Daily stylist message limit reached. Upgrade for more.",
      "QUOTA_EXCEEDED"
    );
  }
  await prisma.entitlement.upsert({
    where: { billingAccountId_key: { billingAccountId: account.id, key } },
    create: {
      billingAccountId: account.id,
      key,
      value: { count: used + 1 },
      source: "usage",
    },
    update: { value: { count: used + 1 }, source: "usage" },
  });
}

export async function assertCanAddWardrobeItem(userId: string): Promise<void> {
  if (!isBillingEnabled()) return;
  const snap = await getEntitlementSnapshot(userId);
  const count = await prisma.wardrobeItem.count({
    where: { wardrobe: { userId } },
  });
  if (count >= snap.wardrobeLimit) {
    throw new EntitlementError(
      "Wardrobe item limit reached. Upgrade for more space.",
      "QUOTA_EXCEEDED"
    );
  }
}

export async function finalizeUsage(
  reservationId: string | null,
  ok: boolean,
  jobId?: string
): Promise<void> {
  if (!reservationId) return;
  if (ok) {
    await captureReservation(reservationId, jobId);
    return;
  }

  const result = await releaseReservation(reservationId);
  if (result.released && !result.usedCredits && result.billingAccountId && result.kind) {
    const pk = periodKey();
    const key =
      result.kind === CreditKind.HD_RENDER
        ? `usage:hd:${pk}`
        : `usage:board:${pk}`;
    await decrementCounter(
      result.billingAccountId,
      key,
      result.amount ?? 1
    );
  }
}

export { EntitlementError };

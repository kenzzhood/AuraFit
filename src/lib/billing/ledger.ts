import { CreditKind, Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const HOLD_TTL_MS = 30 * 60 * 1000;

/** Serialize credit mutations per account+kind via Postgres advisory xact lock. */
async function withLedgerLock<T>(
  billingAccountId: string,
  kind: CreditKind,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`billing_ledger:${billingAccountId}:${kind}`})
      )
    `;
    return fn(tx);
  });
}

async function latestBalance(
  tx: Prisma.TransactionClient,
  billingAccountId: string,
  kind: CreditKind
): Promise<number> {
  const last = await tx.creditLedgerEntry.findFirst({
    where: { billingAccountId, kind },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  return last?.balanceAfter ?? 0;
}

export async function getCreditBalance(
  billingAccountId: string,
  kind: CreditKind
): Promise<number> {
  return withLedgerLock(billingAccountId, kind, (tx) =>
    latestBalance(tx, billingAccountId, kind)
  );
}

export async function grantCredits(params: {
  billingAccountId: string;
  kind: CreditKind;
  amount: number;
  reason: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (params.amount <= 0) {
    throw new Error("Credit grant amount must be positive");
  }
  return withLedgerLock(params.billingAccountId, params.kind, async (tx) => {
    if (params.referenceId) {
      const existing = await tx.creditLedgerEntry.findFirst({
        where: {
          billingAccountId: params.billingAccountId,
          kind: params.kind,
          reason: params.reason,
          referenceId: params.referenceId,
          delta: { gt: 0 },
        },
        select: { balanceAfter: true },
      });
      if (existing) return existing.balanceAfter;
    }

    const current = await latestBalance(tx, params.billingAccountId, params.kind);
    const balanceAfter = current + params.amount;
    await tx.creditLedgerEntry.create({
      data: {
        billingAccountId: params.billingAccountId,
        kind: params.kind,
        delta: params.amount,
        balanceAfter,
        reason: params.reason,
        referenceId: params.referenceId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return balanceAfter;
  });
}

/**
 * Reserve usage: prefer purchased credits, else consume plan quota atomically
 * via conditional entitlement counter update inside the same locked transaction.
 */
export async function reserveUsage(params: {
  billingAccountId: string;
  kind: CreditKind;
  amount?: number;
  jobId?: string;
  /** Max plan uses allowed this period (from catalog). */
  planAllowance: number;
  planCounterKey: string;
}): Promise<{ reservationId: string; source: "credit" | "plan" }> {
  const amount = params.amount ?? 1;
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  return withLedgerLock(params.billingAccountId, params.kind, async (tx) => {
    const creditBal = await latestBalance(
      tx,
      params.billingAccountId,
      params.kind
    );
    const useCredits = creditBal >= amount;

    if (!useCredits) {
      const row = await tx.entitlement.findUnique({
        where: {
          billingAccountId_key: {
            billingAccountId: params.billingAccountId,
            key: params.planCounterKey,
          },
        },
      });
      const used =
        typeof (row?.value as { count?: number } | undefined)?.count === "number"
          ? (row!.value as { count: number }).count
          : 0;
      if (used + amount > params.planAllowance) {
        throw new EntitlementError(
          params.kind === CreditKind.HD_RENDER
            ? "No HD renders remaining. Upgrade or wait for your next billing period."
            : "No style boards remaining. Upgrade, buy a credit pack, or wait for your next period.",
          "QUOTA_EXCEEDED"
        );
      }
      await tx.entitlement.upsert({
        where: {
          billingAccountId_key: {
            billingAccountId: params.billingAccountId,
            key: params.planCounterKey,
          },
        },
        create: {
          billingAccountId: params.billingAccountId,
          key: params.planCounterKey,
          value: { count: used + amount },
          source: "usage",
        },
        update: {
          value: { count: used + amount },
          source: "usage",
        },
      });
    }

    const created = await tx.usageReservation.create({
      data: {
        billingAccountId: params.billingAccountId,
        kind: params.kind,
        amount,
        status: ReservationStatus.HELD,
        jobId: params.jobId,
        expiresAt,
      },
    });

    if (useCredits) {
      const current = await latestBalance(
        tx,
        params.billingAccountId,
        params.kind
      );
      if (current < amount) {
        throw new EntitlementError("Insufficient credits", "QUOTA_EXCEEDED");
      }
      await tx.creditLedgerEntry.create({
        data: {
          billingAccountId: params.billingAccountId,
          kind: params.kind,
          delta: -amount,
          balanceAfter: current - amount,
          reason: "reservation_hold",
          referenceId: created.id,
        },
      });
    }

    return {
      reservationId: created.id,
      source: useCredits ? ("credit" as const) : ("plan" as const),
    };
  });
}

export async function captureReservation(
  reservationId: string,
  jobId?: string
): Promise<void> {
  await prisma.usageReservation.updateMany({
    where: {
      id: reservationId,
      status: ReservationStatus.HELD,
    },
    data: {
      status: ReservationStatus.CAPTURED,
      jobId: jobId ?? undefined,
      finalizedAt: new Date(),
    },
  });
}

export async function releaseReservation(reservationId: string): Promise<{
  released: boolean;
  usedCredits: boolean;
  billingAccountId?: string;
  kind?: CreditKind;
  amount?: number;
}> {
  const reservation = await prisma.usageReservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation) {
    return { released: false, usedCredits: false };
  }

  return withLedgerLock(
    reservation.billingAccountId,
    reservation.kind,
    async (tx) => {
      const claimed = await tx.usageReservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.HELD },
        data: {
          status: ReservationStatus.RELEASED,
          finalizedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        return { released: false, usedCredits: false };
      }

      const hold = await tx.creditLedgerEntry.findFirst({
        where: {
          billingAccountId: reservation.billingAccountId,
          kind: reservation.kind,
          reason: "reservation_hold",
          referenceId: reservationId,
          delta: { lt: 0 },
        },
      });

      if (hold) {
        const existingRelease = await tx.creditLedgerEntry.findFirst({
          where: {
            reason: "reservation_release",
            referenceId: reservationId,
          },
        });
        if (!existingRelease) {
          const current = await latestBalance(
            tx,
            reservation.billingAccountId,
            reservation.kind
          );
          await tx.creditLedgerEntry.create({
            data: {
              billingAccountId: reservation.billingAccountId,
              kind: reservation.kind,
              delta: reservation.amount,
              balanceAfter: current + reservation.amount,
              reason: "reservation_release",
              referenceId: reservationId,
            },
          });
        }
        return {
          released: true,
          usedCredits: true,
          billingAccountId: reservation.billingAccountId,
          kind: reservation.kind,
          amount: reservation.amount,
        };
      }

      return {
        released: true,
        usedCredits: false,
        billingAccountId: reservation.billingAccountId,
        kind: reservation.kind,
        amount: reservation.amount,
      };
    }
  );
}

export async function reservationUsedCredits(
  reservationId: string
): Promise<boolean> {
  const hold = await prisma.creditLedgerEntry.findFirst({
    where: {
      reason: "reservation_hold",
      referenceId: reservationId,
      delta: { lt: 0 },
    },
    select: { id: true },
  });
  return Boolean(hold);
}

export class EntitlementError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
  }
}

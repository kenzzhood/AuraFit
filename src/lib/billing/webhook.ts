import { BillingProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fulfillCapturedPayment } from "./fulfillment";
import { verifyWebhookSignature } from "./razorpay";
import { isBillingEnabled } from "./config";

type RazorpayWebhookPayload = {
  event: string;
  contains?: string[];
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        order_id?: string | null;
        notes?: Record<string, string>;
        status?: string;
      };
    };
    payment_link?: {
      entity?: {
        id?: string;
        notes?: Record<string, string>;
        amount_paid?: number;
        currency?: string;
      };
    };
  };
};

export async function processRazorpayWebhook(
  rawBody: string,
  signature: string | null
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const signatureValid = verifyWebhookSignature(rawBody, signature);
  if (!signatureValid) {
    return { ok: false, error: "Invalid webhook signature" };
  }

  if (!isBillingEnabled()) {
    return { ok: false, error: "Billing disabled" };
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  const eventType = body.event ?? "unknown";
  const paymentId = body.payload?.payment?.entity?.id;
  // Deduplicate dual events (payment.captured + payment_link.paid) on payment id.
  const providerEventId = paymentId
    ? `payment:${paymentId}`
    : `${eventType}:${Buffer.from(rawBody).toString("base64url").slice(0, 48)}`;

  try {
    await prisma.billingWebhookEvent.create({
      data: {
        provider: BillingProvider.RAZORPAY,
        providerEventId,
        eventType,
        payload: body as object,
        signatureValid: true,
      },
    });
  } catch {
    const existing = await prisma.billingWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: BillingProvider.RAZORPAY,
          providerEventId,
        },
      },
    });
    if (existing?.processedAt) {
      return { ok: true, duplicate: true };
    }
    // In-flight duplicate — claim only if still unprocessed
    if (existing) {
      const claimed = await prisma.billingWebhookEvent.updateMany({
        where: { id: existing.id, processedAt: null, processingError: null },
        data: { processingError: "claimed" },
      });
      if (claimed.count !== 1 && existing.processedAt) {
        return { ok: true, duplicate: true };
      }
    } else {
      return { ok: true, duplicate: true };
    }
  }

  const eventRow = await prisma.billingWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: BillingProvider.RAZORPAY,
        providerEventId,
      },
    },
  });
  if (!eventRow) {
    return { ok: false, error: "Webhook event missing" };
  }
  if (eventRow.processedAt) {
    return { ok: true, duplicate: true };
  }

  try {
    if (
      eventType === "payment.captured" ||
      eventType === "payment_link.paid"
    ) {
      const payment = body.payload?.payment?.entity;
      const link = body.payload?.payment_link?.entity;
      const notes = {
        ...(link?.notes ?? {}),
        ...(payment?.notes ?? {}),
      };
      const amount = payment?.amount ?? link?.amount_paid;
      const currency = payment?.currency ?? link?.currency;
      const orderOrLinkId = payment?.order_id ?? link?.id ?? null;

      if (!payment?.id || !amount || !currency) {
        throw new Error("Webhook missing payment id/amount/currency");
      }

      // Resolve account/catalog from PENDING checkout when possible.
      let billingAccountId = notes.billingAccountId;
      let catalogKey = notes.catalogKey;
      if (orderOrLinkId) {
        const pending = await prisma.paymentTransaction.findFirst({
          where: {
            provider: BillingProvider.RAZORPAY,
            providerOrderId: orderOrLinkId,
            status: { in: ["PENDING", "CREATED"] },
          },
          orderBy: { createdAt: "desc" },
        });
        if (pending) {
          billingAccountId = pending.billingAccountId;
          catalogKey = pending.catalogKey;
        }
      }

      if (!billingAccountId || !catalogKey) {
        throw new Error("Webhook missing billingAccountId/catalogKey");
      }

      await fulfillCapturedPayment({
        billingAccountId,
        catalogKey,
        providerPaymentId: payment.id,
        providerOrderId: orderOrLinkId,
        amountMinor: amount,
        currency: currency.toUpperCase(),
        raw: body,
      });
    }

    await prisma.billingWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date(), processingError: null },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    await prisma.billingWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processingError: msg },
    });
    return { ok: false, error: msg };
  }
}

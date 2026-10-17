import { createHmac, timingSafeEqual } from "node:crypto";
import {
  assertCheckoutAllowed,
  razorpayKeyId,
  razorpayKeySecret,
  razorpayWebhookSecret,
} from "./config";
import type { CatalogItem } from "./catalog";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function authHeader(): string {
  const key = razorpayKeyId();
  const secret = razorpayKeySecret();
  if (!key || !secret) throw new Error("Razorpay keys missing");
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function razorpayFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { description?: string };
  };
  if (!res.ok) {
    const msg =
      body?.error?.description ?? `Razorpay API ${res.status} on ${path}`;
    throw new Error(msg);
  }
  return body;
}

export type PaymentLinkResult = {
  id: string;
  shortUrl: string;
  amount: number;
  currency: string;
};

export async function createPaymentLink(params: {
  item: CatalogItem;
  receipt: string;
  customer: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
  callbackUrl: string;
}): Promise<PaymentLinkResult> {
  assertCheckoutAllowed();
  const payload = {
    amount: params.item.amountMinor,
    currency: params.item.currency,
    accept_partial: false,
    reference_id: params.receipt.slice(0, 40),
    description: params.item.name,
    customer: params.customer,
    notify: { sms: false, email: true },
    reminder_enable: false,
    notes: params.notes,
    callback_url: params.callbackUrl,
    callback_method: "get",
  };
  const link = await razorpayFetch<{
    id: string;
    short_url: string;
    amount: number;
    currency: string;
  }>("/payment_links", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    id: link.id,
    shortUrl: link.short_url,
    amount: link.amount,
    currency: link.currency,
  };
}

export async function createSubscriptionCheckout(params: {
  item: CatalogItem;
  customer: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
  totalCount: number;
  callbackUrl: string;
}): Promise<PaymentLinkResult | { subscriptionId: string; shortUrl: string }> {
  assertCheckoutAllowed();
  const planId = params.item.razorpayPlanEnv
    ? process.env[params.item.razorpayPlanEnv]?.trim()
    : undefined;

  // Prefer Razorpay Plans when configured; otherwise fall back to payment link
  // for the first period (manual renew until plans are created in dashboard).
  if (!planId) {
    return createPaymentLink({
      item: params.item,
      receipt: `sub_${Date.now()}`,
      customer: params.customer,
      notes: { ...params.notes, mode: "subscription_first_period" },
      callbackUrl: params.callbackUrl,
    });
  }

  const sub = await razorpayFetch<{
    id: string;
    short_url?: string;
  }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: params.totalCount,
      customer_notify: 1,
      notes: params.notes,
      notify_info: {
        notify_email: params.customer.email,
      },
    }),
  });

  return {
    subscriptionId: sub.id,
    shortUrl: sub.short_url ?? `https://rzp.io/i/${sub.id}`,
  };
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = razorpayWebhookSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function publicKeyId(): string | undefined {
  return razorpayKeyId();
}

/** Cancel a Razorpay subscription at period end (stops future charges). */
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<void> {
  assertCheckoutAllowed();
  await razorpayFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({
      cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
    }),
  });
}

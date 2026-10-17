/** Feature flags — live charging requires explicit BILLING_LIVE_MODE=true. */

export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

export function isBillingLiveMode(): boolean {
  return isBillingEnabled() && process.env.BILLING_LIVE_MODE === "true";
}

function looksLiveKey(key: string): boolean {
  return key.startsWith("rzp_live_");
}

export function razorpayKeyId(): string | undefined {
  if (isBillingLiveMode()) {
    const key = process.env.RAZORPAY_KEY_ID?.trim();
    return key || undefined;
  }
  // Non-live: ONLY test keys — never fall back to live env vars.
  const key = process.env.RAZORPAY_TEST_KEY_ID?.trim();
  return key || undefined;
}

export function razorpayKeySecret(): string | undefined {
  if (isBillingLiveMode()) {
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    return secret || undefined;
  }
  const secret = process.env.RAZORPAY_TEST_KEY_SECRET?.trim();
  return secret || undefined;
}

export function razorpayWebhookSecret(): string | undefined {
  if (isBillingLiveMode()) {
    return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || undefined;
  }
  return (
    process.env.RAZORPAY_TEST_WEBHOOK_SECRET?.trim() ||
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

export const CHECKOUT_UNAVAILABLE_MESSAGE =
  "Paid plans are not open yet. You can keep using Free.";

export function assertCheckoutAllowed(): void {
  if (!isBillingEnabled()) {
    throw new Error(CHECKOUT_UNAVAILABLE_MESSAGE);
  }
  if (isBillingLiveMode() && process.env.BILLING_LIVE_APPROVED !== "true") {
    throw new Error(
      "Live billing is gated. Set BILLING_LIVE_APPROVED=true only after go/no-go approval."
    );
  }
  const keyId = razorpayKeyId();
  const secret = razorpayKeySecret();
  if (!keyId || !secret) {
    throw new Error(
      isBillingLiveMode()
        ? "Razorpay live keys are not configured."
        : "Razorpay test keys are not configured (RAZORPAY_TEST_KEY_ID / RAZORPAY_TEST_KEY_SECRET)."
    );
  }
  if (!isBillingLiveMode() && looksLiveKey(keyId)) {
    throw new Error("Live Razorpay key rejected while BILLING_LIVE_MODE is false.");
  }
  if (isBillingLiveMode() && !looksLiveKey(keyId) && keyId.startsWith("rzp_")) {
    throw new Error("Live mode requires a rzp_live_ key id.");
  }
}

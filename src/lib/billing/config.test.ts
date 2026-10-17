import { afterEach, describe, expect, it } from "vitest";
import {
  assertCheckoutAllowed,
  isBillingEnabled,
  isBillingLiveMode,
} from "./config";

const keys = [
  "BILLING_ENABLED",
  "BILLING_LIVE_MODE",
  "BILLING_LIVE_APPROVED",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_TEST_KEY_ID",
  "RAZORPAY_TEST_KEY_SECRET",
] as const;

afterEach(() => {
  for (const k of keys) delete process.env[k];
});

describe("billing config", () => {
  it("defaults billing off", () => {
    expect(isBillingEnabled()).toBe(false);
    expect(isBillingLiveMode()).toBe(false);
  });

  it("blocks checkout when disabled", () => {
    expect(() => assertCheckoutAllowed()).toThrow(
      /Paid plans are not open yet/
    );
  });

  it("blocks live mode without approval", () => {
    process.env.BILLING_ENABLED = "true";
    process.env.BILLING_LIVE_MODE = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_live_x";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    expect(() => assertCheckoutAllowed()).toThrow(/gated/i);
  });

  it("allows test checkout when enabled with test keys", () => {
    process.env.BILLING_ENABLED = "true";
    process.env.BILLING_LIVE_MODE = "false";
    process.env.RAZORPAY_TEST_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_TEST_KEY_SECRET = "secret";
    expect(() => assertCheckoutAllowed()).not.toThrow();
  });

  it("ignores live keys when not in live mode", () => {
    process.env.BILLING_ENABLED = "true";
    process.env.BILLING_LIVE_MODE = "false";
    process.env.RAZORPAY_KEY_ID = "rzp_live_x";
    process.env.RAZORPAY_KEY_SECRET = "live_secret";
    // No test keys → must fail (does not fall back to live)
    expect(() => assertCheckoutAllowed()).toThrow(/test keys/i);
  });
});

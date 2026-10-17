export type PlanTier = "free" | "plus" | "pro";

export type CatalogItem = {
  key: string;
  kind: "subscription" | "credit_pack";
  tier?: PlanTier;
  name: string;
  description: string;
  amountMinor: number;
  currency: "INR" | "USD";
  interval?: "month" | "year";
  /** Boards / HD granted for credit packs, or included monthly for plans. */
  boards?: number;
  hdRenders?: number;
  wardrobeLimit?: number;
  chatMessagesPerDay?: number;
  /** Razorpay plan id override via env, e.g. RAZORPAY_PLAN_PLUS_MONTH */
  razorpayPlanEnv?: string;
  highlight?: boolean;
  /** Shown on pricing cards (e.g. "Most popular"). */
  badge?: string;
};

/**
 * Server-owned catalog — never trust client prices.
 *
 * Pricing rationale (2026 research):
 * - AI fashion apps cluster at ~$5–20/mo; many convert at ~$10.
 * - India consumer apps convert best around ₹149–499/mo with UPI.
 * - Free forever + short Plus trial beats hard paywall for fashion discovery.
 * - Annual ≈ 2 months free (~17% off) — strong India preference.
 */
export const BILLING_CATALOG: Record<string, CatalogItem> = {
  free: {
    key: "free",
    kind: "subscription",
    tier: "free",
    name: "Free",
    description: "Forever free — enough boards to try the atelier.",
    amountMinor: 0,
    currency: "INR",
    interval: "month",
    boards: 2,
    hdRenders: 0,
    wardrobeLimit: 40,
    chatMessagesPerDay: 15,
  },
  plus_month_inr: {
    key: "plus_month_inr",
    kind: "subscription",
    tier: "plus",
    name: "Plus",
    description: "Your weekly stylist — boards, HD, and wardrobe room.",
    amountMinor: 19900, // ₹199
    currency: "INR",
    interval: "month",
    boards: 12,
    hdRenders: 4,
    wardrobeLimit: 150,
    chatMessagesPerDay: 80,
    razorpayPlanEnv: "RAZORPAY_PLAN_PLUS_MONTH_INR",
    highlight: true,
    badge: "Most popular",
  },
  plus_year_inr: {
    key: "plus_year_inr",
    kind: "subscription",
    tier: "plus",
    name: "Plus (annual)",
    description: "Plus for a year — two months free.",
    amountMinor: 199900, // ₹1,999 ≈ 10× monthly
    currency: "INR",
    interval: "year",
    boards: 12,
    hdRenders: 4,
    wardrobeLimit: 150,
    chatMessagesPerDay: 80,
    razorpayPlanEnv: "RAZORPAY_PLAN_PLUS_YEAR_INR",
  },
  pro_month_inr: {
    key: "pro_month_inr",
    kind: "subscription",
    tier: "pro",
    name: "Pro",
    description: "Heavy styling weeks, more HD, bigger closet.",
    amountMinor: 49900, // ₹499
    currency: "INR",
    interval: "month",
    boards: 35,
    hdRenders: 15,
    wardrobeLimit: 400,
    chatMessagesPerDay: 250,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_MONTH_INR",
  },
  pro_year_inr: {
    key: "pro_year_inr",
    kind: "subscription",
    tier: "pro",
    name: "Pro (annual)",
    description: "Pro yearly — best value for power stylists.",
    amountMinor: 499900, // ₹4,999
    currency: "INR",
    interval: "year",
    boards: 35,
    hdRenders: 15,
    wardrobeLimit: 400,
    chatMessagesPerDay: 250,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_YEAR_INR",
  },
  plus_month_usd: {
    key: "plus_month_usd",
    kind: "subscription",
    tier: "plus",
    name: "Plus",
    description: "Your weekly stylist — boards, HD, and wardrobe room.",
    amountMinor: 499, // $4.99
    currency: "USD",
    interval: "month",
    boards: 12,
    hdRenders: 4,
    wardrobeLimit: 150,
    chatMessagesPerDay: 80,
    razorpayPlanEnv: "RAZORPAY_PLAN_PLUS_MONTH_USD",
    highlight: true,
    badge: "Most popular",
  },
  plus_year_usd: {
    key: "plus_year_usd",
    kind: "subscription",
    tier: "plus",
    name: "Plus (annual)",
    description: "Plus for a year — two months free.",
    amountMinor: 4999, // $49.99
    currency: "USD",
    interval: "year",
    boards: 12,
    hdRenders: 4,
    wardrobeLimit: 150,
    chatMessagesPerDay: 80,
    razorpayPlanEnv: "RAZORPAY_PLAN_PLUS_YEAR_USD",
  },
  pro_month_usd: {
    key: "pro_month_usd",
    kind: "subscription",
    tier: "pro",
    name: "Pro",
    description: "Heavy styling weeks, more HD, bigger closet.",
    amountMinor: 999, // $9.99
    currency: "USD",
    interval: "month",
    boards: 35,
    hdRenders: 15,
    wardrobeLimit: 400,
    chatMessagesPerDay: 250,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_MONTH_USD",
  },
  pro_year_usd: {
    key: "pro_year_usd",
    kind: "subscription",
    tier: "pro",
    name: "Pro (annual)",
    description: "Pro yearly — best value for power stylists.",
    amountMinor: 9999, // $99.99
    currency: "USD",
    interval: "year",
    boards: 35,
    hdRenders: 15,
    wardrobeLimit: 400,
    chatMessagesPerDay: 250,
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_YEAR_USD",
  },
  credits_board_3_inr: {
    key: "credits_board_3_inr",
    kind: "credit_pack",
    name: "3 style boards",
    description: "One-time pack when you need a few extra looks.",
    amountMinor: 7900, // ₹79
    currency: "INR",
    boards: 3,
  },
  credits_board_10_inr: {
    key: "credits_board_10_inr",
    kind: "credit_pack",
    name: "10 style boards",
    description: "Burst pack for a big styling weekend.",
    amountMinor: 17900, // ₹179
    currency: "INR",
    boards: 10,
  },
  credits_board_3_usd: {
    key: "credits_board_3_usd",
    kind: "credit_pack",
    name: "3 style boards",
    description: "One-time pack when you need a few extra looks.",
    amountMinor: 199, // $1.99
    currency: "USD",
    boards: 3,
  },
  credits_board_10_usd: {
    key: "credits_board_10_usd",
    kind: "credit_pack",
    name: "10 style boards",
    description: "Burst pack for a big styling weekend.",
    amountMinor: 499, // $4.99
    currency: "USD",
    boards: 10,
  },
};

/** Days of Plus access for new accounts (no card). 0 disables. */
export function trialDays(): number {
  const n = Number(process.env.BILLING_TRIAL_DAYS ?? "7");
  if (!Number.isFinite(n) || n < 0) return 7;
  return Math.min(30, Math.floor(n));
}

export function getCatalogItem(key: string): CatalogItem | undefined {
  return BILLING_CATALOG[key];
}

export function listPublicCatalog(currency: "INR" | "USD" = "INR"): CatalogItem[] {
  return Object.values(BILLING_CATALOG).filter(
    (item) => item.key === "free" || item.currency === currency
  );
}

export function planQuotas(planKey: string): {
  boards: number;
  hdRenders: number;
  wardrobeLimit: number;
  chatMessagesPerDay: number;
  tier: PlanTier;
} {
  const item = BILLING_CATALOG[planKey] ?? BILLING_CATALOG.free;
  return {
    boards: item.boards ?? 2,
    hdRenders: item.hdRenders ?? 0,
    wardrobeLimit: item.wardrobeLimit ?? 40,
    chatMessagesPerDay: item.chatMessagesPerDay ?? 15,
    tier: item.tier ?? "free",
  };
}

export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "INR" ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

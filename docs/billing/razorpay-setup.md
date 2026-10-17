# Razorpay setup (Aurafit)

Gateway choice: **Razorpay** — best fit for an India-first entity (UPI, cards, netbanking, international cards). Aurafit sells digital styling only; clothing stays on affiliate retailer checkouts.

## 1. Dashboard

1. Create / sign in at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Complete KYC when you are ready for **live** (not required for test mode).
3. **Settings → API Keys → Generate Test Key** → copy Key Id + Key Secret into env (never commit).

## 2. Webhook

1. **Settings → Webhooks → Add New Webhook**
2. URL: `https://<your-app-host>/api/billing/webhook/razorpay`
3. Secret: generate and store as `RAZORPAY_TEST_WEBHOOK_SECRET` (test) / `RAZORPAY_WEBHOOK_SECRET` (live)
4. Events (minimum):
   - `payment.captured`
   - `payment_link.paid`
5. When you create Razorpay Subscription Plans, also enable subscription paid/cancelled events.

Local tip: use a tunnel (ngrok / Cloudflare) so Razorpay can reach your webhook during test.

## 3. App env (test)

```bash
BILLING_ENABLED=true
BILLING_LIVE_MODE=false
BILLING_LIVE_APPROVED=false
BILLING_TRIAL_DAYS=7
RAZORPAY_TEST_KEY_ID=rzp_test_...
RAZORPAY_TEST_KEY_SECRET=...
RAZORPAY_TEST_WEBHOOK_SECRET=...
```

Apply Prisma migration `20260718_add_billing` first.

## 4. Verify end-to-end

1. Open `/pricing` → Subscribe (Plus or Pro) or buy a credit pack.
2. Pay with Razorpay test cards / UPI test flow.
3. Confirm webhook hits and `/billing` shows updated plan / credits.
4. Confirm generate respects quotas (402 when exhausted with billing on).
5. Confirm cart “checkout” still only opens retailer tabs.

## 5. Catalog prices (server-owned)

| Plan | INR | USD | Notes |
|------|-----|-----|--------|
| Free forever | ₹0 | — | 2 boards/mo |
| Plus trial | — | — | 7 days Plus, no card (`BILLING_TRIAL_DAYS`) |
| Plus | ₹199/mo · ₹1,999/yr | $4.99 · $49.99 | Default conversion tier |
| Pro | ₹499/mo · ₹4,999/yr | $9.99 · $99.99 | Power users |
| Board packs | ₹79 / ₹179 | $1.99 / $4.99 | One-time |

Prices live in `src/lib/billing/catalog.ts` — never trust the client.

## 6. Optional subscription Plans

For true recurring billing, create Plans in Razorpay matching catalog amounts and set:

```bash
RAZORPAY_PLAN_PLUS_MONTH_INR=plan_...
RAZORPAY_PLAN_PLUS_YEAR_INR=plan_...
RAZORPAY_PLAN_PRO_MONTH_INR=plan_...
RAZORPAY_PLAN_PRO_YEAR_INR=plan_...
# + USD variants if used
```

Until Plans exist, checkout uses **payment links** (one-time / renew via new checkout).

## 7. Live go-live (explicit approval)

See [launch-checklist.md](./launch-checklist.md). Requires `BILLING_LIVE_APPROVED=true` plus live keys. Do not enable without a written go/no-go.

## 8. Android later

Play Store digital goods → Google Play Billing + RevenueCat → same entitlement ledger. Do **not** use Razorpay IAP on Play.

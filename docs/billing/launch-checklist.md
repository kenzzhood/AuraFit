# Aurafit billing launch checklist

Digital styling subscriptions only. Clothing remains affiliate outbound checkout.

## Before enabling test billing

- [ ] Apply Prisma migration `20260718_add_billing` to staging DB
- [ ] Create Razorpay **test** API keys
- [ ] Configure webhook: `POST {APP_URL}/api/billing/webhook/razorpay`
  - Events: `payment.captured`, `payment_link.paid` (add subscription events when Plans are live)
- [ ] Follow [razorpay-setup.md](./razorpay-setup.md) for keys + webhook
- [ ] Set on staging Container App:
  - `BILLING_ENABLED=true`
  - `BILLING_LIVE_MODE=false`
  - `BILLING_LIVE_APPROVED=false`
  - `BILLING_TRIAL_DAYS=7`
  - `RAZORPAY_TEST_KEY_ID` / `RAZORPAY_TEST_KEY_SECRET` / `RAZORPAY_TEST_WEBHOOK_SECRET`
- [ ] Verify `/pricing` → checkout → webhook → `/billing` entitlements
- [ ] Verify generate returns `402` when free quota exhausted (with billing on)
- [ ] Confirm cart “checkout” still only opens retailer tabs (no Razorpay)

## Before live charging (explicit approval required)

- [ ] Razorpay KYC / live activation for Indian entity
- [ ] Legal pages reviewed by counsel: Terms, Privacy, Refund, Affiliate
- [ ] `BILLING_LIVE_APPROVED=true` set **only** after written go/no-go
- [ ] Live keys in Key Vault / Container App secrets (never git)
- [ ] `BILLING_LIVE_MODE=true` + `BILLING_ENABLED=true`
- [ ] Webhook secret rotated to live
- [ ] Optional: create Razorpay Plans and set `RAZORPAY_PLAN_*` env vars
- [ ] Redis recommended for multi-replica rate limits (`REDIS_URL`)

## Android (phase 2)

- [ ] Google Play Billing products mirrored to catalog
- [ ] RevenueCat + webhook → same entitlement ledger
- [ ] No Razorpay IAP for digital goods on Play

## Security gates (before public + billing)

- [ ] Historical secrets rotated + git history purged
- [ ] `RATE_LIMIT_REQUIRE_REDIS=true` with `REDIS_URL` on multi-replica web
- [ ] Razorpay webhook idempotency verified (single credit grant)
- [ ] Affiliate URLs reject `javascript:` / non-retailers
- [ ] Soft-deleted users cannot call generate/billing

## Do not

- Unlock entitlements from browser redirect alone
- Commit live keys or set live flags without approval
- Mix Aurafit subscription UX with retailer clothing checkout
- Set live Razorpay keys in env while `BILLING_LIVE_MODE=false` (ignored / rejected)

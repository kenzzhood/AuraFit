# Final security report

**Project:** AuraFit  
**Audit date:** 2026-06-05  
**Scope:** Full repository — web API, mobile client, product crawler, Azure infra, secrets posture  
**Auditor role:** Principal Security Engineer (release gate)

---

## Executive summary

Critical and High **application vulnerabilities identified in the prior audit have been remediated in code**. The repository is **not yet safe for public release** due to **operational blockers**: encrypted credentials remain recoverable from git history, and credential rotation has not been verified.

| Severity | Open | Fixed (this release) |
|----------|------|---------------------|
| Critical | 2 | 2 |
| High | 8 | 8 |
| Medium | 6 | 0 |
| Low | 4 | 0 |

---

## Critical findings

### C-1 — Encrypted secrets bundle in git history

| | |
|---|---|
| **Status** | **OPEN** (operational) |
| **Evidence** | `git log -- secrets/env.bundle.enc` → commit `a2558fa` |
| **Impact** | Passphrase + bundle could recover production credentials |
| **Remediation** | Use your own keys ([docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md)) then [GIT_HISTORY_PURGE.md](GIT_HISTORY_PURGE.md) |
| **Code fix** | File removed from tree; `secrets/*.enc` gitignored |

### C-2 — Chat conversation IDOR

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/app/api/chat/route.ts` |
| **Fix** | Ownership check before read/write on `conversationId` |
| **Verification** | Code review; auth required via middleware |

---

## High findings

### H-1 — Product search session IDOR

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/app/api/products/session/[id]/route.ts`, `getProductSearchSessionForUser()` |
| **Fix** | Session lookup scoped to authenticated user |

### H-2 — Wardrobe metadata exposed on public posts

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/api/sanitize-public.ts`, posts routes |
| **Fix** | Strips `raw`, `blobPath`, wardrobe internals from public responses |

### H-3 — SSRF via user-controlled URLs

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/security/ssrf.ts`, `src/lib/azure/images.ts`, crawler `validators/ssrf.py` |
| **Fix** | Blocks localhost, private IPs, metadata; allowlist for user media; DNS check on crawler |
| **Verification** | `npm test` (8/8), `pytest tests/test_ssrf.py` (4/4) |

### H-4 — Wardrobe blob path not validated

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/security/blob-path.ts`, `src/app/api/wardrobe/route.ts` |
| **Fix** | Path must match `aurafit/<clerkUserId>/...` |

### H-5 — Crawler unauthenticated access

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `services/product-crawler/main.py` |
| **Fix** | `CRAWLER_API_KEY` required at startup; `verify_key()` on all endpoints |

### H-6 — Long-lived Azure Blob SAS tokens

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/storage/providers/azure-blob.ts` |
| **Fix** | Default 60-minute SAS (`AZURE_BLOB_READ_SAS_MINUTES`) |

### H-7 — Missing rate limits on expensive endpoints

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/redis.ts`, chat/search/recommendations/generate routes |
| **Fix** | Per-user rate limits with 429 responses |
| **Note** | Requires Redis in multi-instance production for distributed enforcement |

### H-8 — Debug logging to local filesystem

| | |
|---|---|
| **Status** | **FIXED** |
| **Location** | `src/lib/azure/images.ts`, `src/lib/ai/providers/azure.ts` |
| **Fix** | Removed `appendFileSync` debug instrumentation |

---

## Medium findings (open)

### M-1 — Health endpoint information disclosure

| | |
|---|---|
| **Location** | `src/app/api/health/route.ts` |
| **Issue** | `?debug=1` exposes route manifest; `?warm=1` probes DB/crawler without auth |
| **Recommendation** | Gate behind `INGEST_API_KEY` or remove debug in production |

### M-2 — Affiliate open redirect

| | |
|---|---|
| **Location** | `src/app/api/affiliate/route.ts`, `recordAffiliateClick()` |
| **Issue** | No domain allowlist on outbound product URLs |
| **Recommendation** | Allowlist retailer domains from product cache |

### M-3 — `replace-item` trusts client product metadata

| | |
|---|---|
| **Location** | `src/app/api/generate/replace-item/route.ts` |
| **Recommendation** | Re-fetch product from session/cache server-side |

### M-4 — Post comments visibility

| | |
|---|---|
| **Location** | `src/app/api/posts/[id]/comments/route.ts` |
| **Recommendation** | Verify post visibility before returning comments |

### M-5 — Inngest route publicly reachable

| | |
|---|---|
| **Location** | Middleware whitelist `/api/inngest` |
| **Mitigation** | Signing key verification in Inngest SDK — acceptable if key is strong |

### M-6 — npm audit — Next.js DoS advisory

| | |
|---|---|
| **Package** | `next@15.4.10` (GHSA-9g9p-9gw9-jx7f) |
| **Recommendation** | Upgrade to `>=15.5.10` when compatible |

---

## Low findings (open)

### L-1 — Vitest critical advisory (dev-only)

| | |
|---|---|
| **Package** | `vitest@2.1.9` — arbitrary file read when UI server running |
| **Impact** | Dev dependency only; not shipped to production |
| **Recommendation** | Upgrade to `>=3.2.6` |

### L-2 — Expo / mobile transitive vulnerabilities

| | |
|---|---|
| **Impact** | Build-time and client dependencies |
| **Recommendation** | Track Expo SDK updates; run `npm audit` in `apps/mobile` |

### L-3 — Clerk Expo authorization bypass advisory

| | |
|---|---|
| **Package** | `@clerk/clerk-expo` |
| **Recommendation** | Upgrade to patched version per GHSA-w24r-5266-9c3c |

### L-4 — Default dev crawler key in docker-compose

| | |
|---|---|
| **Location** | `docker-compose.crawler.yml` — `dev-crawler-key` |
| **Impact** | Local dev only |
| **Recommendation** | Document that production must use strong random key |

---

## Configuration review

| Area | Status | Notes |
|------|--------|-------|
| Authentication | **PASS** | Clerk middleware; 401 on API routes; production hard-block without keys |
| Authorization | **PASS** | IDOR fixes on chat, sessions, posts visibility |
| Storage | **PASS** | User-scoped blob paths; short SAS |
| SSRF | **PASS** | Web + crawler guards |
| Secrets in repo | **FAIL** | History contains encrypted bundle |
| `.gitignore` | **PASS** | `.env*`, `secrets/*.enc`, `.azure/` |
| Crawler auth | **PASS** | API key required |
| CORS | **PASS** | `CORS_ALLOWED_ORIGINS` configurable |
| Rate limiting | **PASS** | Implemented; Redis recommended for prod |

---

## Dependency review summary

```
npm audit: 1 critical, 10 high, 21 moderate, 3 low (35 total)
```

| Category | Action |
|----------|--------|
| Production runtime (Next.js) | Monitor Next.js patch; moderate DoS advisory |
| Dev tools (vitest) | Upgrade when convenient |
| Mobile (Expo) | Separate audit path; mostly transitive |

---

## Auth review summary

- All sensitive API routes require Clerk session except documented public routes (`/api/posts`, `/api/health`, `/api/inngest`, profiles).
- Mobile receives proper 401 (not Clerk rewrite 404).
- Internal ingest requires `x-ingest-key`.
- Crawler requires `x-crawler-key`.

---

## Storage review summary

- User uploads scoped by Clerk ID in blob path.
- Public post API sanitizes wardrobe/product raw data.
- Azure SAS lifetime capped at 60 minutes by default.
- Cloudinary preferred path avoids long-lived SAS when configured.

---

## Release gate decision

See [RELEASE_READINESS_REPORT.md](RELEASE_READINESS_REPORT.md) for full release audit.

**Verdict:** ❌ **NOT READY FOR PUBLIC RELEASE** until:

1. Configure your own credentials ([docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md))
2. Git history purged ([GIT_HISTORY_PURGE.md](GIT_HISTORY_PURGE.md))
3. GitHub secret scanning enabled
4. Security fixes committed and pushed

---

## Verification commands run

```bash
npm run type-check   # PASS
npm run build        # PASS
npm test             # PASS (8 SSRF tests)
python3 -m pytest services/product-crawler/tests/test_ssrf.py  # PASS
git log -- secrets/env.bundle.enc  # FAIL — history contains bundle
```

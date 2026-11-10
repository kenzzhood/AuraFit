# Cleanup

The store product does not use the old consumer styling app. This pass removed it. The reason for each group is the same: the product spec is an in-store kiosk, staff desk, owner report, and hosted product page, not a social wardrobe app.

## Removed

| What | Why |
| --- | --- |
| `src/app/(marketing)`, `(auth)`, `(social)`, `generate`, `wardrobe`, `chat`, `outfits`, `cart`, `billing`, `dashboard`, `onboarding`, `my-posts` | Consumer screens. The spec does not have them. |
| Consumer API routes under `src/app/api` (products, generate, posts, billing, cart, chat, wardrobe, inngest, affiliate, upload, and the rest) | Those routes served the consumer app and Clerk. Store routes under kiosk, staff, owner, admin, auth, whatsapp, analytics, and health stay. |
| `src/components`, `src/lib`, `src/inngest`, `src/store`, `src/types` | Consumer UI, Prisma data access, crawler, SerpAPI, Cloudinary, Replicate, billing, and queues. Store logic lives in `src/modules`. |
| `apps/mobile` | Expo consumer app. The phone in the spec is the kiosk controller and WhatsApp, not a separate native app. |
| `services/product-crawler`, `services/scrapy-indexer` | Paid and scraped shopping search. Catalogue search is local. |
| `prisma/`, `supabase/` | The store database is Drizzle on PGlite or Postgres, not the consumer schema. |
| `evals/`, `secrets/`, `taste-skill/` | Eval fixtures for the crawler, encrypted consumer secrets, and a duplicate of the vendored design skill. The skill copy that stays is `.cursor/skills`. |
| `docker-compose.*.yml`, `azure/`, `azure.yaml`, `infra/` | Consumer Postgres, crawler, and the Azure template that injected Clerk, Cloudinary, SerpAPI, and Inngest. A store Container Apps template is part of the store runtime, not this template. |
| Scripts other than `scripts/design-audit.mjs` | Azure pause/resume, mobile rewire, crawler probes, and Prisma migrate helpers for the deleted stack. |
| Consumer docs (`docs/deploy`, `docs/hackathon`, `docs/billing`, `docs/qa`, `docs/seo`, `docs/pitch-deck`, mobile and discovery guides) | They describe the deleted product. The spec, design notes, and engineering notes stay. |
| Dependencies: Clerk, Prisma, Sentry, PostHog, Inngest, Redis, Cloudinary, Azure Service Bus, the `ai` SDK, Framer Motion, GSAP, Expo, React Native, Tailwind, Sharp | Nothing left imports them. |

## Kept

`src/modules`, the store routes, `DESIGN.md`, `src/design/store.css`, the product spec, design references, and `.cursor/skills`.

## Baseline before this deletion

On `f3d9405`: `tsc` passed, `next lint` passed, vitest 51 files / 250 tests passed.

## Audit

Critical and high findings were cleared by leaving the consumer dependency tree and moving to Next.js 16.4.6, Zod 4.6.7, and Vitest 5.1.0. Seven moderate findings remain in the TypeScript ESLint toolchain. `npm audit --audit-level=high` exits 0.

## Image model constant

`gpt-image-2.5-sunburst` on Azure is version `2026-09-08` and retires `2027-09-08`. The previous constants used 09 September. They now match the live catalog.

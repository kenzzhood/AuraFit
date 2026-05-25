# Aurafit hackathon stack (Vercel + Supabase + Clerk)

This runbook matches the migration target: **Next.js** on **Vercel**, **Supabase Postgres + pgvector**, **Clerk**, **Cloudinary**, **Inngest**, **Azure OpenAI**, optional **Replicate** try-on, **PostHog** analytics.

If `npm install` fails on a peer dependency for `inngest`, use `npm install --legacy-peer-deps` (this repo was installed that way).

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the contents of `supabase/pgvector.sql` (`CREATE EXTENSION vector`).
3. Copy the **database URI** (pooling or direct) into `DATABASE_URL`.
4. From the repo: `npm run db:push` (or `npm run db:migrate` if you use migrations).

## 2. Clerk

Create an application, add authorized redirect URLs for your Vercel preview + production URLs, then set the `NEXT_PUBLIC_CLERK_*` and `CLERK_SECRET_KEY` variables.

## 3. Cloudinary

Create a Cloudinary account, copy **cloud name**, **API key**, and **API secret**. New uploads use Cloudinary when these are set; otherwise the app falls back to Azure Blob if Azure keys exist.

## 4. Inngest

1. Create an app in [Inngest](https://app.inngest.com).
2. Set **INNGEST_EVENT_KEY** (send events from production) and **INNGEST_SIGNING_KEY** (verify the serve endpoint).
3. Register the URL: `https://<your-domain>/api/inngest` (Vercel deployment URL).

If Inngest and Service Bus are both unset, generation jobs still run via Next.js `after()` on the same deployment (good for local dev; use a short timeout-friendly workload).

## 5. Azure OpenAI

Deploy **chat** (e.g. gpt-4o) and **embedding** (e.g. text-embedding-3-large) models and set `AZURE_OPENAI_*`. Without them, generation still completes using demo products and heuristic look plans.

## 6. Try-on (optional)

Set `REPLICATE_API_TOKEN`. Override `REPLICATE_TRYON_MODEL` if your model uses different input keys than `human_img` / `garm_img`.

## 7. PostHog

Create a project and set `NEXT_PUBLIC_POSTHOG_KEY` (and optional `NEXT_PUBLIC_POSTHOG_HOST` for EU cloud).

## 8. Smoke test

1. Sign up / sign in.
2. Upload a wardrobe image (exercises Cloudinary or Azure).
3. Open **Generate**, run a job; confirm status goes to **DONE** and the grid shows product links.
4. Click a product link: should hit `/api/affiliate` then open a tagged URL.
5. Confirm `/api/inngest` responds when Inngest sync runs (production).

## 9. Vercel env

Copy from `.env.example` into the Vercel project; ensure `DATABASE_URL`, Clerk, Cloudinary, Inngest signing + event keys, and Azure OpenAI are set for production.

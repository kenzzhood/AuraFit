# ─────────────────────────────────────────────────────────────────────────────
# Aurafit web — Next.js 15 (App Router) production image
# build: 2026-06-12 clerk-csp-fix
# Multi-stage build with Next.js standalone output for the smallest possible
# runtime image. Tuned for Azure Container Apps.
#
# NOTE: avoid BuildKit-only directives like `# syntax=...` or
# `RUN --mount=type=cache`. ACR Tasks (used by `azd deploy`) runs the classic
# Docker builder and will fail on those.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.18.1

# ── 1. deps: install workspace deps with sharp built for linux-x64 ──────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* .npmrc* ./
COPY prisma ./prisma

RUN npm ci --no-audit --no-fund --ignore-scripts \
 && npx prisma generate

# ── 2. builder: compile Next.js standalone bundle ───────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# NEXT_PUBLIC_* are inlined into client bundles at build time — pass from azd/ACR.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build \
 && test -f .next/server/app/generate/page.js

# ── 3. runner: minimal runtime image ────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone output-file-tracing can drop App Router page segments on the ACR
# Linux builder (observed: /generate, /wardrobe, etc. returning 404 in prod even
# though they build fine). Overlay the full compiled server tree so every page
# handler, prerendered .html/.rsc, and manifest is guaranteed present at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next/server ./.next/server
COPY --from=builder --chown=nextjs:nodejs /app/.next/routes-manifest.json ./.next/routes-manifest.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/prerender-manifest.json ./.next/prerender-manifest.json

# Prisma engines + schema for prisma migrate / queryRaw at runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

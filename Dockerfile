# ─────────────────────────────────────────────────────────────────────────────
# Aurafit web — Next.js 15 (App Router) production image
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

RUN npm run build \
 && ls -la .next/standalone/.next/server/app/ \
 && test -f .next/standalone/.next/server/app/generate/page.js

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

# Standalone tracing can drop App Router segments on some Linux builders — copy explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/generate ./.next/server/app/generate
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/wardrobe ./.next/server/app/wardrobe
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/chat ./.next/server/app/chat
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/dashboard ./.next/server/app/dashboard
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/onboarding ./.next/server/app/onboarding
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/my-posts ./.next/server/app/my-posts
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app/outfits ./.next/server/app/outfits
COPY --from=builder --chown=nextjs:nodejs /app/.next/server/app-paths-manifest.json ./.next/server/app-paths-manifest.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/routes-manifest.json ./.next/routes-manifest.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/generate ./.next/static/chunks/app/generate
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/wardrobe ./.next/static/chunks/app/wardrobe
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/chat ./.next/static/chunks/app/chat
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/dashboard ./.next/static/chunks/app/dashboard
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/onboarding ./.next/static/chunks/app/onboarding
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/my-posts ./.next/static/chunks/app/my-posts
COPY --from=builder --chown=nextjs:nodejs /app/.next/static/chunks/app/outfits ./.next/static/chunks/app/outfits

# Prisma engines + schema for prisma migrate / queryRaw at runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

-- Additive catalogue-search fields. No drops or renames.

CREATE TYPE "LinkStatus" AS ENUM ('UNVERIFIED', 'LIVE_IN_STOCK', 'LIVE_OOS', 'DEAD', 'BLOCKED', 'GEO_BLOCKED', 'UNKNOWN');

CREATE TYPE "SourceType" AS ENUM ('AFFILIATE_FEED', 'SHOPIFY_JSON', 'SITEMAP_JSONLD', 'D2C_CRAWL', 'LEGACY_GOOGLE', 'LEGACY_SERPAPI');

ALTER TABLE "ProductIndex" ADD COLUMN "sourceType" "SourceType",
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "priceInr" DECIMAL(12,2),
ADD COLUMN "imageHash" TEXT,
ADD COLUMN "host" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "attributes" JSONB,
ADD COLUMN "ratingCount" INTEGER,
ADD COLUMN "shipsToIn" BOOLEAN,
ADD COLUMN "linkStatus" "LinkStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifyReason" TEXT,
ADD COLUMN "deadSince" TIMESTAMP(3),
ADD COLUMN "feedUpdatedAt" TIMESTAMP(3),
ADD COLUMN "affiliateNetwork" TEXT;

CREATE INDEX "ProductIndex_linkStatus_verifiedAt_idx" ON "ProductIndex"("linkStatus", "verifiedAt");
CREATE INDEX "ProductIndex_host_idx" ON "ProductIndex"("host");
CREATE INDEX "ProductIndex_gender_category_idx" ON "ProductIndex"("gender", "category");

ALTER TABLE "AffiliateClick" ADD COLUMN "verifyStatusAtClick" TEXT,
ADD COLUMN "fallbackUsed" BOOLEAN DEFAULT false,
ADD COLUMN "fallbackProductId" TEXT,
ADD COLUMN "finalRedirectUrl" TEXT;

CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "productIndexId" TEXT,
    "status" "LinkStatus" NOT NULL,
    "httpStatus" INTEGER,
    "reason" TEXT,
    "finalUrl" TEXT,
    "latencyMs" INTEGER,
    "context" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationEvent_productIndexId_createdAt_idx" ON "VerificationEvent"("productIndexId", "createdAt");

ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_productIndexId_fkey" FOREIGN KEY ("productIndexId") REFERENCES "ProductIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DiscoveryLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT,
    "intent" JSONB NOT NULL,
    "poolBySource" JSONB NOT NULL,
    "poolByHost" JSONB NOT NULL,
    "picks" JSONB NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryLog_createdAt_idx" ON "DiscoveryLog"("createdAt");
CREATE INDEX "DiscoveryLog_userId_idx" ON "DiscoveryLog"("userId");

CREATE TABLE "CoverageGap" (
    "id" TEXT NOT NULL,
    "intent" JSONB NOT NULL,
    "poolSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoverageGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoverageGap_createdAt_idx" ON "CoverageGap"("createdAt");

CREATE TABLE "DiscoveryCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscoveryCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "DiscoveryCache_expiresAt_idx" ON "DiscoveryCache"("expiresAt");

CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "upserted" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngestRun_source_startedAt_idx" ON "IngestRun"("source", "startedAt");

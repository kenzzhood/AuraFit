-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductSearchSessionStatus" AS ENUM ('PARTIAL', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ProductIndex" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "imageUrl" TEXT,
    "productUrl" TEXT NOT NULL,
    "category" TEXT,
    "colors" JSONB,
    "aestheticTags" JSONB,
    "rating" DOUBLE PRECISION,
    "availability" "ProductAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "region" TEXT NOT NULL DEFAULT 'IN',
    "contentHash" TEXT,
    "raw" JSONB,
    "lastCrawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "id" TEXT NOT NULL,
    "productIndexId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'text-embedding-3-large',
    "embedding" vector NOT NULL,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'IN',
    "category" TEXT,
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSearchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "generationJobId" TEXT,
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'IN',
    "category" TEXT,
    "status" "ProductSearchSessionStatus" NOT NULL DEFAULT 'PARTIAL',
    "productsJson" JSONB,
    "providerMeta" JSONB,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "aestheticKeywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSearchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductIndex_productUrl_key" ON "ProductIndex"("productUrl");

-- CreateIndex
CREATE INDEX "ProductIndex_region_category_idx" ON "ProductIndex"("region", "category");

-- CreateIndex
CREATE INDEX "ProductIndex_contentHash_idx" ON "ProductIndex"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIndex_source_externalId_key" ON "ProductIndex"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEmbedding_productIndexId_key" ON "ProductEmbedding"("productIndexId");

-- CreateIndex
CREATE INDEX "CrawlJob_status_createdAt_idx" ON "CrawlJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlJob_sessionId_idx" ON "CrawlJob"("sessionId");

-- CreateIndex
CREATE INDEX "ProductSearchSession_generationJobId_idx" ON "ProductSearchSession"("generationJobId");

-- CreateIndex
CREATE INDEX "ProductSearchSession_userId_status_idx" ON "ProductSearchSession"("userId", "status");

-- CreateIndex
CREATE INDEX "ProductSearchSession_updatedAt_idx" ON "ProductSearchSession"("updatedAt");

-- AddForeignKey
ALTER TABLE "ProductEmbedding" ADD CONSTRAINT "ProductEmbedding_productIndexId_fkey" FOREIGN KEY ("productIndexId") REFERENCES "ProductIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

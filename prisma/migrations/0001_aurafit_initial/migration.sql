-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ANALYSIS', 'GENERATION', 'PRODUCTS');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "OutfitCategory" AS ENUM ('TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'FOOTWEAR', 'ACCESSORY', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "profileImageUrl" TEXT,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "measurements" JSONB,
    "bodyAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StylePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aesthetics" JSONB,
    "colors" JSONB,
    "brands" JSONB,
    "occasions" JSONB,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "region" TEXT,
    "currency" TEXT DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StylePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wardrobe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wardrobe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WardrobeItem" (
    "id" TEXT NOT NULL,
    "wardrobeId" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" "OutfitCategory" NOT NULL DEFAULT 'OTHER',
    "tags" JSONB,
    "colors" JSONB,
    "styleLabels" JSONB,
    "brand" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WardrobeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionEmbedding" (
    "id" TEXT NOT NULL,
    "wardrobeItemId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'text-embedding-3-large',
    "embedding" vector(1536) NOT NULL,

    CONSTRAINT "FashionEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "occasion" TEXT,
    "styleNotes" TEXT,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PRIVATE',
    "caption" TEXT,
    "lookNumber" INTEGER,
    "tags" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT,
    "wardrobeItemId" TEXT,
    "productCacheId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "OutfitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCache" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER,
    "currency" TEXT DEFAULT 'INR',
    "imageUrl" TEXT,
    "productUrl" TEXT NOT NULL,
    "category" TEXT,
    "raw" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "blobPath" TEXT,
    "cdnUrl" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PROCESSING',
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "jobType" "JobType" NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outfitId" TEXT,
    "source" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "productCacheId" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "StylePreference_userId_key" ON "StylePreference"("userId");

-- CreateIndex
CREATE INDEX "Wardrobe_userId_idx" ON "Wardrobe"("userId");

-- CreateIndex
CREATE INDEX "WardrobeItem_wardrobeId_idx" ON "WardrobeItem"("wardrobeId");

-- CreateIndex
CREATE INDEX "WardrobeItem_category_idx" ON "WardrobeItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "FashionEmbedding_wardrobeItemId_key" ON "FashionEmbedding"("wardrobeItemId");

-- CreateIndex
CREATE INDEX "Outfit_userId_idx" ON "Outfit"("userId");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Post_outfitId_idx" ON "Post"("outfitId");

-- CreateIndex
CREATE INDEX "Post_visibility_publishedAt_idx" ON "Post"("visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_userId_postId_key" ON "PostLike"("userId", "postId");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "OutfitItem_outfitId_idx" ON "OutfitItem"("outfitId");

-- CreateIndex
CREATE INDEX "ProductCache_expiresAt_idx" ON "ProductCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCache_source_externalId_key" ON "ProductCache"("source", "externalId");

-- CreateIndex
CREATE INDEX "GeneratedImage_outfitId_idx" ON "GeneratedImage"("outfitId");

-- CreateIndex
CREATE INDEX "GenerationJob_userId_status_idx" ON "GenerationJob"("userId", "status");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_userId_idx" ON "AffiliateClick"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "StylePreference" ADD CONSTRAINT "StylePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wardrobe" ADD CONSTRAINT "Wardrobe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WardrobeItem" ADD CONSTRAINT "WardrobeItem_wardrobeId_fkey" FOREIGN KEY ("wardrobeId") REFERENCES "Wardrobe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionEmbedding" ADD CONSTRAINT "FashionEmbedding_wardrobeItemId_fkey" FOREIGN KEY ("wardrobeItemId") REFERENCES "WardrobeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outfit" ADD CONSTRAINT "Outfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_wardrobeItemId_fkey" FOREIGN KEY ("wardrobeItemId") REFERENCES "WardrobeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_productCacheId_fkey" FOREIGN KEY ("productCacheId") REFERENCES "ProductCache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


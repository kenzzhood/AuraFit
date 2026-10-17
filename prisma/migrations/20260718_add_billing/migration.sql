-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('RAZORPAY', 'REVENUECAT', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('CREATED', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SUBSCRIPTION', 'CREDIT_PACK', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('STANDARD_BOARD', 'HD_RENDER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'CAPTURED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('CREATED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayCustomerId" TEXT,
    "revenueCatAppUserId" TEXT,
    "planKey" TEXT NOT NULL DEFAULT 'free',
    "status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "graceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "interval" "BillingInterval" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "providerOrderId" TEXT,
    "catalogKey" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "creditKind" "CreditKind",
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageReservation" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "jobId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAuditLog" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_userId_key" ON "BillingAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_razorpayCustomerId_key" ON "BillingAccount"("razorpayCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_revenueCatAppUserId_key" ON "BillingAccount"("revenueCatAppUserId");

-- CreateIndex
CREATE INDEX "BillingAccount_planKey_status_idx" ON "BillingAccount"("planKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_billingAccountId_status_idx" ON "Subscription"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planKey_idx" ON "Subscription"("planKey");

-- CreateIndex
CREATE INDEX "PaymentTransaction_billingAccountId_createdAt_idx" ON "PaymentTransaction"("billingAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_providerOrderId_idx" ON "PaymentTransaction"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_provider_providerPaymentId_key" ON "PaymentTransaction"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_provider_providerEventId_key" ON "BillingWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_processedAt_idx" ON "BillingWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_eventType_createdAt_idx" ON "BillingWebhookEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_billingAccountId_key_key" ON "Entitlement"("billingAccountId", "key");

-- CreateIndex
CREATE INDEX "Entitlement_expiresAt_idx" ON "Entitlement"("expiresAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_billingAccountId_kind_createdAt_idx" ON "CreditLedgerEntry"("billingAccountId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_referenceId_idx" ON "CreditLedgerEntry"("referenceId");

-- CreateIndex
CREATE INDEX "UsageReservation_billingAccountId_status_idx" ON "UsageReservation"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "UsageReservation_jobId_idx" ON "UsageReservation"("jobId");

-- CreateIndex
CREATE INDEX "UsageReservation_expiresAt_idx" ON "UsageReservation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_transactionId_providerRefundId_key" ON "Refund"("transactionId", "providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_billingAccountId_idx" ON "Refund"("billingAccountId");

-- CreateIndex
CREATE INDEX "BillingAuditLog_billingAccountId_createdAt_idx" ON "BillingAuditLog"("billingAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAuditLog_action_createdAt_idx" ON "BillingAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_document_createdAt_idx" ON "ConsentRecord"("userId", "document", "createdAt");

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageReservation" ADD CONSTRAINT "UsageReservation_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAuditLog" ADD CONSTRAINT "BillingAuditLog_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

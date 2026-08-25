-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('EXPLORER', 'CREATOR', 'PAIR', 'SERVICE_PROVIDER');

-- AlterTable: add the new profileType column, backfilled from the existing accountType enum
ALTER TABLE "Profile" ADD COLUMN     "profileType" "ProfileType" NOT NULL DEFAULT 'EXPLORER';

UPDATE "Profile" SET "profileType" = UPPER("accountType"::text)::"ProfileType";

-- Drop the old dual-tracked fields now that profileType is the single source of truth
DROP INDEX "Profile_isCreator_idx";
DROP INDEX "Profile_accountType_idx";
ALTER TABLE "Profile" DROP COLUMN "isCreator",
DROP COLUMN "isCouple",
DROP COLUMN "accountType";
DROP TYPE "AccountType";

-- CreateIndex
CREATE INDEX "Profile_profileType_idx" ON "Profile"("profileType");

-- AlterTable
ALTER TABLE "CreatorTier" ADD COLUMN     "tierType" TEXT NOT NULL DEFAULT 'basic';

-- CreateTable
CREATE TABLE "PremiumSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorSubscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorEarning" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMetric" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "userId" TEXT,
    "metricType" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumSubscription_userId_key" ON "PremiumSubscription"("userId");

-- CreateIndex
CREATE INDEX "PremiumSubscription_status_idx" ON "PremiumSubscription"("status");

-- CreateIndex
CREATE INDEX "CreatorSubscription_subscriberId_idx" ON "CreatorSubscription"("subscriberId");

-- CreateIndex
CREATE INDEX "CreatorSubscription_creatorId_idx" ON "CreatorSubscription"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorSubscription_status_idx" ON "CreatorSubscription"("status");

-- CreateIndex
CREATE INDEX "CreatorEarning_creatorId_idx" ON "CreatorEarning"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorEarning_month_idx" ON "CreatorEarning"("month");

-- CreateIndex
CREATE INDEX "CreatorEarning_status_idx" ON "CreatorEarning"("status");

-- CreateIndex
CREATE INDEX "EngagementMetric_creatorId_idx" ON "EngagementMetric"("creatorId");

-- CreateIndex
CREATE INDEX "EngagementMetric_metricType_idx" ON "EngagementMetric"("metricType");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- AddForeignKey
ALTER TABLE "PremiumSubscription" ADD CONSTRAINT "PremiumSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubscription" ADD CONSTRAINT "CreatorSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubscription" ADD CONSTRAINT "CreatorSubscription_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSubscription" ADD CONSTRAINT "CreatorSubscription_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CreatorTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorEarning" ADD CONSTRAINT "CreatorEarning_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMetric" ADD CONSTRAINT "EngagementMetric_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMetric" ADD CONSTRAINT "EngagementMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

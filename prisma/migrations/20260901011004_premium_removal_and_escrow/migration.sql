-- CreateEnum
CREATE TYPE "ServiceBookingStatus" AS ENUM ('pending_payment', 'pending_provider', 'confirmed', 'declined', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('held', 'released', 'refunded');

-- DropForeignKey
ALTER TABLE "EngagementMetric" DROP CONSTRAINT "EngagementMetric_providerId_fkey";

-- DropForeignKey
ALTER TABLE "EngagementMetric" DROP CONSTRAINT "EngagementMetric_userId_fkey";

-- DropForeignKey
ALTER TABLE "MonetizationApplication" DROP CONSTRAINT "MonetizationApplication_providerId_fkey";

-- DropForeignKey
ALTER TABLE "PremiumSubscription" DROP CONSTRAINT "PremiumSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProviderEarning" DROP CONSTRAINT "ProviderEarning_providerId_fkey";

-- DropIndex
DROP INDEX "Profile_profileType_isMonetized_idx";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "isMonetized",
DROP COLUMN "monetizationStatus",
DROP COLUMN "monetizedAt";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "isPremium",
ADD COLUMN     "escrowReleasedAt" TIMESTAMP(3),
ADD COLUMN     "escrowStatus" "EscrowStatus",
ADD COLUMN     "providerReference" TEXT,
ADD COLUMN     "serviceBookingId" TEXT;

-- DropTable
DROP TABLE "EngagementMetric";

-- DropTable
DROP TABLE "MonetizationApplication";

-- DropTable
DROP TABLE "PremiumSubscription";

-- DropTable
DROP TABLE "ProviderEarning";

-- CreateTable
CREATE TABLE "ServiceBooking" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "status" "ServiceBookingStatus" NOT NULL DEFAULT 'pending_payment',
    "declineReason" TEXT,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceBooking_listingId_idx" ON "ServiceBooking"("listingId");

-- CreateIndex
CREATE INDEX "ServiceBooking_providerId_idx" ON "ServiceBooking"("providerId");

-- CreateIndex
CREATE INDEX "ServiceBooking_customerId_idx" ON "ServiceBooking"("customerId");

-- CreateIndex
CREATE INDEX "ServiceBooking_status_idx" ON "ServiceBooking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_serviceBookingId_key" ON "Transaction"("serviceBookingId");

-- CreateIndex
CREATE INDEX "Transaction_escrowStatus_idx" ON "Transaction"("escrowStatus");

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_serviceBookingId_fkey" FOREIGN KEY ("serviceBookingId") REFERENCES "ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;


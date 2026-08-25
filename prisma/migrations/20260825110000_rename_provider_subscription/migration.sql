-- Rename CreatorSubscription -> ProviderSubscription (and creatorId -> providerId)
-- now that Pairs and Service Providers can also sell paid tiers, not just Creators.

ALTER TABLE "CreatorSubscription" RENAME TO "ProviderSubscription";
ALTER TABLE "ProviderSubscription" RENAME COLUMN "creatorId" TO "providerId";

ALTER TABLE "ProviderSubscription" RENAME CONSTRAINT "CreatorSubscription_pkey" TO "ProviderSubscription_pkey";
ALTER TABLE "ProviderSubscription" RENAME CONSTRAINT "CreatorSubscription_creatorId_fkey" TO "ProviderSubscription_providerId_fkey";
ALTER TABLE "ProviderSubscription" RENAME CONSTRAINT "CreatorSubscription_subscriberId_fkey" TO "ProviderSubscription_subscriberId_fkey";
ALTER TABLE "ProviderSubscription" RENAME CONSTRAINT "CreatorSubscription_tierId_fkey" TO "ProviderSubscription_tierId_fkey";

ALTER INDEX "CreatorSubscription_creatorId_idx" RENAME TO "ProviderSubscription_providerId_idx";
ALTER INDEX "CreatorSubscription_status_idx" RENAME TO "ProviderSubscription_status_idx";
ALTER INDEX "CreatorSubscription_subscriberId_idx" RENAME TO "ProviderSubscription_subscriberId_idx";

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceListing_providerId_idx" ON "ServiceListing"("providerId");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

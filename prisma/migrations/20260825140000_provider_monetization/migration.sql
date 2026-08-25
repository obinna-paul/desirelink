-- Providers must be "monetized" before their engagement counts toward the
-- rewards pool (app/api/cron/monthly-rewards, lib/rewards/earnings.ts).
-- This never affects a provider's own Fan (ProviderSubscription/Subscription)
-- revenue — only their eligibility for the platform-funded rewards pool.

ALTER TABLE "Profile" ADD COLUMN "isMonetized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "monetizedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "monetizationStatus" TEXT NOT NULL DEFAULT 'none';

CREATE INDEX "Profile_profileType_isMonetized_idx" ON "Profile"("profileType", "isMonetized");

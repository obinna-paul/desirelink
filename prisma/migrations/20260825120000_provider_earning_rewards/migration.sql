-- Rename CreatorEarning -> ProviderEarning and creatorId -> providerId, now that
-- Pairs and Service Providers earn from the rewards pool too, not just Creators.
-- Also renames EngagementMetric.creatorId -> providerId for the same reason,
-- adds an index on createdAt (the monthly-rewards cron filters metrics by
-- month range), and a uniqueness constraint on (providerId, month) so that
-- cron runs can upsert idempotently.

ALTER TABLE "CreatorEarning" RENAME TO "ProviderEarning";
ALTER TABLE "ProviderEarning" RENAME COLUMN "creatorId" TO "providerId";

ALTER TABLE "ProviderEarning" RENAME CONSTRAINT "CreatorEarning_pkey" TO "ProviderEarning_pkey";
ALTER TABLE "ProviderEarning" RENAME CONSTRAINT "CreatorEarning_creatorId_fkey" TO "ProviderEarning_providerId_fkey";

ALTER INDEX "CreatorEarning_creatorId_idx" RENAME TO "ProviderEarning_providerId_idx";
ALTER INDEX "CreatorEarning_month_idx" RENAME TO "ProviderEarning_month_idx";
ALTER INDEX "CreatorEarning_status_idx" RENAME TO "ProviderEarning_status_idx";

CREATE UNIQUE INDEX "ProviderEarning_providerId_month_key" ON "ProviderEarning"("providerId", "month");

ALTER TABLE "EngagementMetric" RENAME COLUMN "creatorId" TO "providerId";
ALTER TABLE "EngagementMetric" RENAME CONSTRAINT "EngagementMetric_creatorId_fkey" TO "EngagementMetric_providerId_fkey";
ALTER INDEX "EngagementMetric_creatorId_idx" RENAME TO "EngagementMetric_providerId_idx";

CREATE INDEX "EngagementMetric_createdAt_idx" ON "EngagementMetric"("createdAt");

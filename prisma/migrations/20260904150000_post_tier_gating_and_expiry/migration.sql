-- AlterTable
ALTER TABLE "Post" ADD COLUMN "tierId" TEXT;

-- AlterTable
ALTER TABLE "ProviderSubscription" ADD COLUMN "expiryWarningSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Post_tierId_idx" ON "Post"("tierId");

-- CreateIndex
CREATE INDEX "ProviderSubscription_status_endsAt_idx" ON "ProviderSubscription"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CreatorTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing premium post gets assigned to its author's cheapest tier,
-- so posts made before per-tier gating existed keep working under the new rule instead
-- of silently losing their tier (see Post.tierId's doc comment in schema.prisma for the
-- null-tierId fallback this leaves in place for creators with no tiers at all).
UPDATE "Post" p
SET "tierId" = (
  SELECT ct."id"
  FROM "CreatorTier" ct
  WHERE ct."creatorId" = p."authorId"
  ORDER BY ct."priceCents" ASC
  LIMIT 1
)
WHERE p."isSubscriberOnly" = true AND p."tierId" IS NULL;

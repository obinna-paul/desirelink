-- AlterTable
-- Nullable, no default and no backfill needed: null means "use the platform default (15%)",
-- which is exactly the behavior every existing row already has. See prisma/schema.prisma's
-- doc comment on Profile.platformFeeRateOverride for the product rationale.
ALTER TABLE "Profile" ADD COLUMN "platformFeeRateOverride" DOUBLE PRECISION;

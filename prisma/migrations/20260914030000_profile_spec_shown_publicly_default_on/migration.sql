-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "specShownPublicly" SET DEFAULT true;

-- Backfill: the feature shipped opt-in only hours before this change, so no one has had a
-- realistic window to make a deliberate opt-out choice yet - flip existing rows to match the
-- new default rather than leaving every profile that took the test before this migration
-- permanently stuck on the old opt-in default. See prisma/schema.prisma's doc comment on
-- Profile.specShownPublicly for the product rationale.
UPDATE "Profile" SET "specShownPublicly" = true WHERE "specShownPublicly" = false;

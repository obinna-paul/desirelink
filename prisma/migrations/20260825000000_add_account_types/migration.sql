-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('creator', 'pair', 'explorer', 'service_provider');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'explorer',
ADD COLUMN     "serviceCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing profiles from their current isCreator/isCouple flags
UPDATE "Profile" SET "accountType" = 'creator' WHERE "isCreator" = true;
UPDATE "Profile" SET "accountType" = 'pair' WHERE "isCreator" = false AND "isCouple" = true;

-- CreateIndex
CREATE INDEX "Profile_accountType_idx" ON "Profile"("accountType");

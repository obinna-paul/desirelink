-- AlterEnum
ALTER TYPE "VerificationRequestType" ADD VALUE 'service_provider';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'in_person',
ADD COLUMN     "onlineUrl" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "isVerifiedServiceProvider" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ServiceListing" ADD COLUMN     "coverImageUrl" TEXT;

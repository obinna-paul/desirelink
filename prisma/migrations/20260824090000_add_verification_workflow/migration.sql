-- CreateEnum
CREATE TYPE "VerificationRequestType" AS ENUM ('creator', 'host');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('pending', 'approved', 'denied');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "isVerifiedCreator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerifiedHost" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "requestType" "VerificationRequestType" NOT NULL,
    "govIdUrl" TEXT NOT NULL,
    "selfieUrl" TEXT NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationRequest_profileId_idx" ON "VerificationRequest"("profileId");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");

-- CreateIndex
CREATE INDEX "VerificationRequest_requestType_status_idx" ON "VerificationRequest"("requestType", "status");

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

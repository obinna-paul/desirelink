-- CreateEnum
CREATE TYPE "PartnerInviteStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- CreateTable
CREATE TABLE "PartnerInvite" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "status" "PartnerInviteStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerInvite_toProfileId_status_idx" ON "PartnerInvite"("toProfileId", "status");

-- CreateIndex
CREATE INDEX "PartnerInvite_fromProfileId_status_idx" ON "PartnerInvite"("fromProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvite_fromProfileId_toProfileId_key" ON "PartnerInvite"("fromProfileId", "toProfileId");

-- AddForeignKey
ALTER TABLE "PartnerInvite" ADD CONSTRAINT "PartnerInvite_fromProfileId_fkey" FOREIGN KEY ("fromProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvite" ADD CONSTRAINT "PartnerInvite_toProfileId_fkey" FOREIGN KEY ("toProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

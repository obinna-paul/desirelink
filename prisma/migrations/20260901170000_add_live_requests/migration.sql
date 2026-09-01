-- AlterTable
ALTER TABLE "LiveStream"
ADD COLUMN "heartGoal" INTEGER,
ADD COLUMN "peakViewers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedRequests" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "LiveRequestStatus" AS ENUM ('pending', 'accepted', 'completed', 'declined', 'expired', 'refunded');

-- CreateTable
CREATE TABLE "LiveRequestPreset" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hearts" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveRequestPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRequestOption" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hearts" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveRequestOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveRequest" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hearts" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "status" "LiveRequestStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveRequestPreset_providerId_sortOrder_idx" ON "LiveRequestPreset"("providerId", "sortOrder");
CREATE INDEX "LiveRequestOption_streamId_sortOrder_idx" ON "LiveRequestOption"("streamId", "sortOrder");
CREATE INDEX "LiveRequest_streamId_status_createdAt_idx" ON "LiveRequest"("streamId", "status", "createdAt");
CREATE INDEX "LiveRequest_requesterId_createdAt_idx" ON "LiveRequest"("requesterId", "createdAt");
CREATE INDEX "LiveRequest_providerId_status_idx" ON "LiveRequest"("providerId", "status");

-- AddForeignKey
ALTER TABLE "LiveRequestPreset" ADD CONSTRAINT "LiveRequestPreset_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveRequestOption" ADD CONSTRAINT "LiveRequestOption_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveRequest" ADD CONSTRAINT "LiveRequest_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveRequest" ADD CONSTRAINT "LiveRequest_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "LiveRequestOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveRequest" ADD CONSTRAINT "LiveRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveRequest" ADD CONSTRAINT "LiveRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

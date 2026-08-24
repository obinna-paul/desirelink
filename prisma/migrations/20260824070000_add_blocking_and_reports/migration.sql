-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('profile', 'message', 'post', 'event');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "targetType" "ReportTargetType" NOT NULL,
ADD COLUMN     "targetId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

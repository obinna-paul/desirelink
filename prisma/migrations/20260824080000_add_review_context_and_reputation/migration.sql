-- CreateEnum
CREATE TYPE "ReviewContextType" AS ENUM ('event', 'transaction');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "contextType" "ReviewContextType" NOT NULL,
ADD COLUMN     "contextId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewerId_revieweeId_contextType_contextId_key" ON "Review"("reviewerId", "revieweeId", "contextType", "contextId");

-- CreateIndex
CREATE INDEX "Review_contextType_contextId_idx" ON "Review"("contextType", "contextId");

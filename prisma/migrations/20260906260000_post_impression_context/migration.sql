-- AlterTable
ALTER TABLE "PostImpression" ADD COLUMN     "surface" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "dwellMs" INTEGER,
ADD COLUMN     "completionPct" DOUBLE PRECISION,
ADD COLUMN     "rankerVersion" TEXT;

-- CreateIndex
CREATE INDEX "PostImpression_createdAt_idx" ON "PostImpression"("createdAt");

-- CreateTable
CREATE TABLE "PostQuality" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "smoothedEngagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "velocityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "trustMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "impressions30d" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostQuality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostQuality_postId_key" ON "PostQuality"("postId");

-- CreateIndex
CREATE INDEX "PostQuality_quality_idx" ON "PostQuality"("quality");

-- AddForeignKey
ALTER TABLE "PostQuality" ADD CONSTRAINT "PostQuality_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

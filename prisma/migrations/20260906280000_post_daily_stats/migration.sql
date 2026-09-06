-- CreateTable
CREATE TABLE "PostDailyStats" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "unlocks" INTEGER NOT NULL DEFAULT 0,
    "weightedEngagement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostDailyStats_postId_idx" ON "PostDailyStats"("postId");

-- CreateIndex
CREATE INDEX "PostDailyStats_date_idx" ON "PostDailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PostDailyStats_postId_date_key" ON "PostDailyStats"("postId", "date");

-- AddForeignKey
ALTER TABLE "PostDailyStats" ADD CONSTRAINT "PostDailyStats_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

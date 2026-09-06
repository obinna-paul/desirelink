-- CreateTable
CREATE TABLE "FeedSlate" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "sessionSeed" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "postIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSlate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedSlate_viewerId_idx" ON "FeedSlate"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSlate_viewerId_sessionSeed_bucketStart_key" ON "FeedSlate"("viewerId", "sessionSeed", "bucketStart");

-- AddForeignKey
ALTER TABLE "FeedSlate" ADD CONSTRAINT "FeedSlate_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

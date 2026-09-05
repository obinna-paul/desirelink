-- CreateTable
CREATE TABLE "PostUnlock" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostUnlock_subscriberId_idx" ON "PostUnlock"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "PostUnlock_postId_subscriberId_key" ON "PostUnlock"("postId", "subscriberId");

-- AddForeignKey
ALTER TABLE "PostUnlock" ADD CONSTRAINT "PostUnlock_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostUnlock" ADD CONSTRAINT "PostUnlock_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

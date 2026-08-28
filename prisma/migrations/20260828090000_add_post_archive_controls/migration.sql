-- AlterTable
ALTER TABLE "Post" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Post_isArchived_idx" ON "Post"("isArchived");

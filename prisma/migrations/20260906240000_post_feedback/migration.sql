-- CreateEnum
CREATE TYPE "PostFeedbackKind" AS ENUM ('interested', 'not_interested');

-- CreateTable
CREATE TABLE "PostFeedback" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" "PostFeedbackKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenCreator" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenCreator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostFeedback_viewerId_idx" ON "PostFeedback"("viewerId");

-- CreateIndex
CREATE INDEX "PostFeedback_postId_idx" ON "PostFeedback"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostFeedback_viewerId_postId_kind_key" ON "PostFeedback"("viewerId", "postId", "kind");

-- CreateIndex
CREATE INDEX "HiddenCreator_viewerId_idx" ON "HiddenCreator"("viewerId");

-- CreateIndex
CREATE INDEX "HiddenCreator_creatorId_idx" ON "HiddenCreator"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "HiddenCreator_viewerId_creatorId_key" ON "HiddenCreator"("viewerId", "creatorId");

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFeedback" ADD CONSTRAINT "PostFeedback_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenCreator" ADD CONSTRAINT "HiddenCreator_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenCreator" ADD CONSTRAINT "HiddenCreator_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

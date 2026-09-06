-- Count a post once per signed-in viewer so feed rerenders and repeat opens do not inflate views.
CREATE TABLE "PostImpression" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostImpression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostImpression_postId_viewerId_key" ON "PostImpression"("postId", "viewerId");
CREATE INDEX "PostImpression_postId_idx" ON "PostImpression"("postId");
CREATE INDEX "PostImpression_viewerId_idx" ON "PostImpression"("viewerId");

ALTER TABLE "PostImpression" ADD CONSTRAINT "PostImpression_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostImpression" ADD CONSTRAINT "PostImpression_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

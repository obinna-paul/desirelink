-- CreateTable
CREATE TABLE "CreatorAffinity" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "affinity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorAffinity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorAffinity_viewerId_idx" ON "CreatorAffinity"("viewerId");

-- CreateIndex
CREATE INDEX "CreatorAffinity_creatorId_idx" ON "CreatorAffinity"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAffinity_viewerId_creatorId_key" ON "CreatorAffinity"("viewerId", "creatorId");

-- AddForeignKey
ALTER TABLE "CreatorAffinity" ADD CONSTRAINT "CreatorAffinity_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorAffinity" ADD CONSTRAINT "CreatorAffinity_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'group_message';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'room_post';

ALTER TABLE "Profile"
ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ModerationQueue"
ADD COLUMN "contentOwnerId" TEXT,
ADD COLUMN "reporterId" TEXT,
ADD COLUMN "action" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "ModerationQueue_contentOwnerId_idx" ON "ModerationQueue"("contentOwnerId");
CREATE INDEX "ModerationQueue_reporterId_idx" ON "ModerationQueue"("reporterId");

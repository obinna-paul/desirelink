-- A durable once-ever receipt for the delayed first-post discovery prompt.
ALTER TABLE "Profile" ADD COLUMN "firstPostNudgeShownAt" TIMESTAMP(3);

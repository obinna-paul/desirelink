-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Profile" ADD COLUMN "digestSentAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "winBackSentAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "earningsSummarySentForMonth" TEXT;

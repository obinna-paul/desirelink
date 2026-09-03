-- AlterTable
ALTER TABLE "LiveStream" ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "startingSoonNotifiedAt" TIMESTAMP(3);

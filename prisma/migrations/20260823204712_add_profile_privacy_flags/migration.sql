-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "showExactLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showInSearch" BOOLEAN NOT NULL DEFAULT true;

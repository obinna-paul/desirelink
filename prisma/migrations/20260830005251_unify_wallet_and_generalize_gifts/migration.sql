/*
  Warnings:

  - You are about to drop the column `providerShareCents` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `peakViewerCount` on the `LiveStream` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_streamId_fkey";

-- AlterTable
ALTER TABLE "Gift" DROP COLUMN "providerShareCents",
ADD COLUMN     "context" TEXT NOT NULL DEFAULT 'live_stream',
ALTER COLUMN "streamId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LiveStream" DROP COLUMN "peakViewerCount";

-- AlterTable
ALTER TABLE "WalletWithdrawal" ADD COLUMN     "feeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netAmountCents" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "tierId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_tierId_idx" ON "Transaction"("tierId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CreatorTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

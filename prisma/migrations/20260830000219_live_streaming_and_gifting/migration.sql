-- DropIndex
DROP INDEX "Profile_payoutSetupStatus_idx";

-- DropIndex
DROP INDEX "ProviderEarning_paidAt_idx";

-- DropIndex
DROP INDEX "ProviderEarning_payoutReference_idx";

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "heartsBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "walletBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LiveStream" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "roomName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "peakViewerCount" INTEGER NOT NULL DEFAULT 0,
    "totalHeartsReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "hearts" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "providerShareCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeartPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hearts" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeartPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payoutReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveStream_roomName_key" ON "LiveStream"("roomName");

-- CreateIndex
CREATE INDEX "LiveStream_providerId_idx" ON "LiveStream"("providerId");

-- CreateIndex
CREATE INDEX "LiveStream_status_idx" ON "LiveStream"("status");

-- CreateIndex
CREATE INDEX "Gift_streamId_idx" ON "Gift"("streamId");

-- CreateIndex
CREATE INDEX "Gift_senderId_idx" ON "Gift"("senderId");

-- CreateIndex
CREATE INDEX "Gift_receiverId_idx" ON "Gift"("receiverId");

-- CreateIndex
CREATE INDEX "HeartPurchase_userId_idx" ON "HeartPurchase"("userId");

-- CreateIndex
CREATE INDEX "HeartPurchase_status_idx" ON "HeartPurchase"("status");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_providerId_idx" ON "WalletWithdrawal"("providerId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_status_idx" ON "WalletWithdrawal"("status");

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeartPurchase" ADD CONSTRAINT "HeartPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

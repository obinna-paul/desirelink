ALTER TABLE "Profile"
ADD COLUMN "payoutProvider" TEXT NOT NULL DEFAULT 'paystack',
ADD COLUMN "payoutRecipientCode" TEXT,
ADD COLUMN "payoutSetupStatus" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN "payoutBankName" TEXT,
ADD COLUMN "payoutAccountLast4" TEXT,
ADD COLUMN "payoutAccountName" TEXT,
ADD COLUMN "payoutCountry" TEXT NOT NULL DEFAULT '',
ADD COLUMN "payoutCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "payoutSetupUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ProviderEarning"
ADD COLUMN "payoutReference" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE INDEX "Profile_payoutSetupStatus_idx" ON "Profile"("payoutSetupStatus");
CREATE INDEX "ProviderEarning_paidAt_idx" ON "ProviderEarning"("paidAt");
CREATE INDEX "ProviderEarning_payoutReference_idx" ON "ProviderEarning"("payoutReference");

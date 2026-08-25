-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_stripeCustomerId_key" ON "Profile"("stripeCustomerId");

-- AlterTable
ALTER TABLE "ProviderSubscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

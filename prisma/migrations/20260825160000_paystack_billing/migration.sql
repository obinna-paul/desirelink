-- Switches the payment abstraction's provider-specific field names to
-- provider-neutral ones now that Paystack (not Stripe) is the active
-- PaymentProvider — a Paystack authorization_code stored in a column
-- literally called "stripePaymentMethodId" would be confusing and wrong.
-- Also adds card-expiry fields (needed for the card management UI), dunning
-- fields for the renewal/retry cron, and a billing-history link from
-- Transaction to ProviderSubscription/PremiumSubscription.

ALTER TABLE "Profile" RENAME COLUMN "stripeCustomerId" TO "paymentCustomerId";
ALTER INDEX "Profile_stripeCustomerId_key" RENAME TO "Profile_paymentCustomerId_key";

ALTER TABLE "PremiumSubscription" RENAME COLUMN "stripeCustomerId" TO "paymentCustomerId";
ALTER TABLE "PremiumSubscription" RENAME COLUMN "stripeSubscriptionId" TO "paymentSubscriptionId";
ALTER TABLE "PremiumSubscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);
ALTER TABLE "PremiumSubscription" ADD COLUMN "paymentRetryCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProviderSubscription" RENAME COLUMN "stripeSubscriptionId" TO "paymentSubscriptionId";
ALTER TABLE "ProviderSubscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);
ALTER TABLE "ProviderSubscription" ADD COLUMN "paymentRetryCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PaymentMethod" RENAME COLUMN "stripePaymentMethodId" TO "externalId";
ALTER TABLE "PaymentMethod" ADD COLUMN "expMonth" INTEGER NOT NULL;
ALTER TABLE "PaymentMethod" ADD COLUMN "expYear" INTEGER NOT NULL;

ALTER TABLE "Transaction" ADD COLUMN "providerSubscriptionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Transaction_providerSubscriptionId_idx" ON "Transaction"("providerSubscriptionId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_providerSubscriptionId_fkey" FOREIGN KEY ("providerSubscriptionId") REFERENCES "ProviderSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

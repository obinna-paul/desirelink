-- Customer-raised refund requests remain held until an admin resolves them.
ALTER TYPE "ServiceBookingStatus" ADD VALUE IF NOT EXISTS 'refund_requested';
ALTER TYPE "EscrowStatus" ADD VALUE IF NOT EXISTS 'refund_pending';

-- Listings are archived rather than deleted so paid booking history stays intact.
ALTER TABLE "ServiceListing"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ServiceBooking"
ADD COLUMN IF NOT EXISTS "refundRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "refundReason" TEXT,
ADD COLUMN IF NOT EXISTS "adminEscalatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ServiceListing_isActive_idx"
ON "ServiceListing"("isActive");

CREATE INDEX IF NOT EXISTS "ServiceBooking_refundRequestedAt_idx"
ON "ServiceBooking"("refundRequestedAt");

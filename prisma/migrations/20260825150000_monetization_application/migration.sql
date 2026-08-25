-- Monetization now requires manual admin review (mirrors VerificationRequest)
-- instead of instant self-serve approval: applying creates a pending
-- MonetizationApplication row, and Profile.isMonetized only flips to true
-- once an admin approves it.

CREATE TABLE "MonetizationApplication" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonetizationApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonetizationApplication_providerId_idx" ON "MonetizationApplication"("providerId");
CREATE INDEX "MonetizationApplication_status_idx" ON "MonetizationApplication"("status");

ALTER TABLE "MonetizationApplication" ADD CONSTRAINT "MonetizationApplication_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

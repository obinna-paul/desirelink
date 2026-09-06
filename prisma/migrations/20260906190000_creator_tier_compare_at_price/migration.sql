-- Optional display-only original price. Payments continue to use priceCents.
ALTER TABLE "CreatorTier"
ADD COLUMN "compareAtPriceCents" INTEGER;

ALTER TABLE "CreatorTier"
ADD CONSTRAINT "CreatorTier_compareAtPriceCents_check"
CHECK (
  "compareAtPriceCents" IS NULL
  OR "compareAtPriceCents" > "priceCents"
);

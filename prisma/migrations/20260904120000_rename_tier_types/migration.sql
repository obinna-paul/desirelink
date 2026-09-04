-- Rename the CreatorTier type categories: basic/premium/vip -> beginner/premium/inner_circle
UPDATE "CreatorTier" SET "tierType" = 'beginner' WHERE "tierType" = 'basic';
UPDATE "CreatorTier" SET "tierType" = 'inner_circle' WHERE "tierType" = 'vip';

-- AlterTable
ALTER TABLE "CreatorTier" ALTER COLUMN "tierType" SET DEFAULT 'beginner';

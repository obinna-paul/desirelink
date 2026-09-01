-- DropForeignKey
ALTER TABLE "Desire" DROP CONSTRAINT IF EXISTS "Desire_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Desire";

-- DropEnum
DROP TYPE IF EXISTS "DesireLevel";

-- DropEnum
DROP TYPE IF EXISTS "PrivacyLevel";


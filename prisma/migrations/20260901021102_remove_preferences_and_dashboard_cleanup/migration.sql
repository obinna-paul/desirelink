-- DropForeignKey
ALTER TABLE "Desire" DROP CONSTRAINT "Desire_userId_fkey";

-- DropTable
DROP TABLE "Desire";

-- DropEnum
DROP TYPE "DesireLevel";

-- DropEnum
DROP TYPE "PrivacyLevel";


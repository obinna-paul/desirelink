-- AlterTable
ALTER TABLE "CreatorTier" DROP COLUMN "requiresApproval";

-- DropTable
DROP TABLE "AccessApplication";

-- DropEnum
DROP TYPE "AccessApplicationStatus";

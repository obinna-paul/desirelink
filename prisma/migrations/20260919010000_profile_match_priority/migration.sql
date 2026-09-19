-- CreateEnum
CREATE TYPE "MatchPriority" AS ENUM ('BALANCED', 'SPARK', 'PARTNERSHIP');

-- AlterTable
ALTER TABLE "Profile"
ADD COLUMN "matchPriority" "MatchPriority" NOT NULL DEFAULT 'BALANCED';

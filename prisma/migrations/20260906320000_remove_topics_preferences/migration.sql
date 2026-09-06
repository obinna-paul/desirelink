-- DropForeignKey
ALTER TABLE "ProfileTopic" DROP CONSTRAINT "ProfileTopic_profileId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileTopic" DROP CONSTRAINT "ProfileTopic_topicId_fkey";

-- DropTable
DROP TABLE "ProfileTopic";

-- DropTable
DROP TABLE "Topic";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "interestsPromptShownAt";

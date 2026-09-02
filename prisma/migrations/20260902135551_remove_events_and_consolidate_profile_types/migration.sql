-- AlterEnum
BEGIN;
CREATE TYPE "AvailabilityStatusType_new" AS ENUM ('available_tonight', 'out_tonight', 'open_to_meeting', 'chatting_only', 'couple_looking');
ALTER TABLE "AvailabilityStatus" ALTER COLUMN "status" TYPE "AvailabilityStatusType_new" USING ("status"::text::"AvailabilityStatusType_new");
ALTER TYPE "AvailabilityStatusType" RENAME TO "AvailabilityStatusType_old";
ALTER TYPE "AvailabilityStatusType_new" RENAME TO "AvailabilityStatusType";
DROP TYPE "public"."AvailabilityStatusType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ChatChannelType_new" AS ENUM ('room');
ALTER TABLE "GroupMessage" ALTER COLUMN "channelType" TYPE "ChatChannelType_new" USING ("channelType"::text::"ChatChannelType_new");
ALTER TABLE "GroupChatMute" ALTER COLUMN "channelType" TYPE "ChatChannelType_new" USING ("channelType"::text::"ChatChannelType_new");
ALTER TYPE "ChatChannelType" RENAME TO "ChatChannelType_old";
ALTER TYPE "ChatChannelType_new" RENAME TO "ChatChannelType";
DROP TYPE "public"."ChatChannelType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PostType_new" AS ENUM ('standard', 'live');
ALTER TABLE "public"."Post" ALTER COLUMN "postType" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "postType" TYPE "PostType_new" USING ("postType"::text::"PostType_new");
ALTER TYPE "PostType" RENAME TO "PostType_old";
ALTER TYPE "PostType_new" RENAME TO "PostType";
DROP TYPE "public"."PostType_old";
ALTER TABLE "Post" ALTER COLUMN "postType" SET DEFAULT 'standard';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProfileType_new" AS ENUM ('EXPLORER', 'PROVIDER');
ALTER TABLE "public"."Profile" ALTER COLUMN "profileType" DROP DEFAULT;
ALTER TABLE "Profile" ALTER COLUMN "profileType" TYPE "ProfileType_new" USING ("profileType"::text::"ProfileType_new");
ALTER TYPE "ProfileType" RENAME TO "ProfileType_old";
ALTER TYPE "ProfileType_new" RENAME TO "ProfileType";
DROP TYPE "public"."ProfileType_old";
ALTER TABLE "Profile" ALTER COLUMN "profileType" SET DEFAULT 'EXPLORER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReportTargetType_new" AS ENUM ('profile', 'message', 'group_message', 'post', 'post_comment', 'room_post');
ALTER TABLE "Report" ALTER COLUMN "targetType" TYPE "ReportTargetType_new" USING ("targetType"::text::"ReportTargetType_new");
ALTER TYPE "ReportTargetType" RENAME TO "ReportTargetType_old";
ALTER TYPE "ReportTargetType_new" RENAME TO "ReportTargetType";
DROP TYPE "public"."ReportTargetType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReviewContextType_new" AS ENUM ('transaction');
ALTER TABLE "Review" ALTER COLUMN "contextType" TYPE "ReviewContextType_new" USING ("contextType"::text::"ReviewContextType_new");
ALTER TYPE "ReviewContextType" RENAME TO "ReviewContextType_old";
ALTER TYPE "ReviewContextType_new" RENAME TO "ReviewContextType";
DROP TYPE "public"."ReviewContextType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VerificationRequestType_new" AS ENUM ('creator', 'service_provider');
ALTER TABLE "VerificationRequest" ALTER COLUMN "requestType" TYPE "VerificationRequestType_new" USING ("requestType"::text::"VerificationRequestType_new");
ALTER TYPE "VerificationRequestType" RENAME TO "VerificationRequestType_old";
ALTER TYPE "VerificationRequestType_new" RENAME TO "VerificationRequestType";
DROP TYPE "public"."VerificationRequestType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_hostId_fkey";

-- DropForeignKey
ALTER TABLE "EventRsvp" DROP CONSTRAINT "EventRsvp_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventRsvp" DROP CONSTRAINT "EventRsvp_userId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_eventId_fkey";

-- DropIndex
DROP INDEX "Post_eventId_idx";

-- DropIndex
DROP INDEX "Profile_isCreator_idx";

-- DropIndex
DROP INDEX "Transaction_eventId_idx";

-- AlterTable
ALTER TABLE "ModerationQueue" ADD COLUMN     "action" TEXT,
ADD COLUMN     "contentOwnerId" TEXT,
ADD COLUMN     "reporterId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "PaymentMethod" ALTER COLUMN "expMonth" DROP DEFAULT,
ALTER COLUMN "expYear" DROP DEFAULT,
ALTER COLUMN "country" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "eventId";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "isCouple",
DROP COLUMN "isCreator",
DROP COLUMN "isVerifiedHost";

-- AlterTable
ALTER TABLE "ServiceListing" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "eventId";

-- AlterTable
ALTER TABLE "VerificationRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "EventRsvp";

-- DropEnum
DROP TYPE "RsvpStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "ModerationQueue_contentOwnerId_idx" ON "ModerationQueue"("contentOwnerId");

-- CreateIndex
CREATE INDEX "ModerationQueue_reporterId_idx" ON "ModerationQueue"("reporterId");


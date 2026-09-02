-- AlterEnum
BEGIN;
CREATE TYPE "ReportTargetType_new" AS ENUM ('profile', 'message', 'post', 'post_comment');
ALTER TABLE "Report" ALTER COLUMN "targetType" TYPE "ReportTargetType_new" USING ("targetType"::text::"ReportTargetType_new");
ALTER TYPE "ReportTargetType" RENAME TO "ReportTargetType_old";
ALTER TYPE "ReportTargetType_new" RENAME TO "ReportTargetType";
DROP TYPE "public"."ReportTargetType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "GroupChatMute" DROP CONSTRAINT "GroupChatMute_mutedById_fkey";

-- DropForeignKey
ALTER TABLE "GroupChatMute" DROP CONSTRAINT "GroupChatMute_userId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMessage" DROP CONSTRAINT "GroupMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_createdById_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "RoomPost" DROP CONSTRAINT "RoomPost_authorId_fkey";

-- DropForeignKey
ALTER TABLE "RoomPost" DROP CONSTRAINT "RoomPost_roomId_fkey";

-- DropTable
DROP TABLE "GroupChatMute";

-- DropTable
DROP TABLE "GroupMessage";

-- DropTable
DROP TABLE "Room";

-- DropTable
DROP TABLE "RoomMember";

-- DropTable
DROP TABLE "RoomPost";

-- DropEnum
DROP TYPE "ChatChannelType";

-- DropEnum
DROP TYPE "RoomMemberStatus";

-- DropEnum
DROP TYPE "RoomRole";


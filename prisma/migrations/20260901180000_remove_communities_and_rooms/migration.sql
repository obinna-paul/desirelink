-- Remove the Communities/Rooms feature entirely: its data, tables, and the enum values that
-- referenced it. The DELETEs run first so narrowing ChatChannelType/ReportTargetType never
-- fails against rows that still use "room"/"room_post" - IF EXISTS guards throughout so this
-- is safe to (re)run even if a prior partial deploy already dropped some of these objects.

-- DeleteData: purge Room-channel group chat activity before narrowing ChatChannelType
DELETE FROM "GroupChatMute" WHERE "channelType" = 'room';
DELETE FROM "GroupMessage" WHERE "channelType" = 'room';

-- DeleteData: purge reports filed against room posts before narrowing ReportTargetType
DELETE FROM "Report" WHERE "targetType" = 'room_post';

-- AlterEnum
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatChannelType') THEN
    CREATE TYPE "ChatChannelType_new" AS ENUM ('event');
    ALTER TABLE "GroupMessage" ALTER COLUMN "channelType" TYPE "ChatChannelType_new" USING ("channelType"::text::"ChatChannelType_new");
    ALTER TABLE "GroupChatMute" ALTER COLUMN "channelType" TYPE "ChatChannelType_new" USING ("channelType"::text::"ChatChannelType_new");
    ALTER TYPE "ChatChannelType" RENAME TO "ChatChannelType_old";
    ALTER TYPE "ChatChannelType_new" RENAME TO "ChatChannelType";
    DROP TYPE IF EXISTS "ChatChannelType_old";
  END IF;
END $$;

-- AlterEnum
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportTargetType') THEN
    CREATE TYPE "ReportTargetType_new" AS ENUM ('profile', 'message', 'group_message', 'post', 'post_comment', 'event');
    ALTER TABLE "Report" ALTER COLUMN "targetType" TYPE "ReportTargetType_new" USING ("targetType"::text::"ReportTargetType_new");
    ALTER TYPE "ReportTargetType" RENAME TO "ReportTargetType_old";
    ALTER TYPE "ReportTargetType_new" RENAME TO "ReportTargetType";
    DROP TYPE IF EXISTS "ReportTargetType_old";
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_createdById_fkey";
ALTER TABLE "RoomMember" DROP CONSTRAINT IF EXISTS "RoomMember_roomId_fkey";
ALTER TABLE "RoomMember" DROP CONSTRAINT IF EXISTS "RoomMember_userId_fkey";
ALTER TABLE "RoomPost" DROP CONSTRAINT IF EXISTS "RoomPost_authorId_fkey";
ALTER TABLE "RoomPost" DROP CONSTRAINT IF EXISTS "RoomPost_roomId_fkey";

-- DropTable
DROP TABLE IF EXISTS "RoomPost";
DROP TABLE IF EXISTS "RoomMember";
DROP TABLE IF EXISTS "Room";

-- DropEnum
DROP TYPE IF EXISTS "RoomMemberStatus";
DROP TYPE IF EXISTS "RoomRole";

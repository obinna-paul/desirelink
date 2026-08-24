-- CreateEnum
CREATE TYPE "RoomMemberStatus" AS ENUM ('pending', 'approved');

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "status" "RoomMemberStatus" NOT NULL DEFAULT 'approved';

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

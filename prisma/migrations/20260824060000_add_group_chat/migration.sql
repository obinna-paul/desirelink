-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('room', 'event');

-- CreateTable
CREATE TABLE "GroupMessage" (
    "id" TEXT NOT NULL,
    "channelType" "ChatChannelType" NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatMute" (
    "id" TEXT NOT NULL,
    "channelType" "ChatChannelType" NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatMute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMessage_channelType_channelId_idx" ON "GroupMessage"("channelType", "channelId");

-- CreateIndex
CREATE INDEX "GroupMessage_senderId_idx" ON "GroupMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupChatMute_channelType_channelId_userId_key" ON "GroupChatMute"("channelType", "channelId", "userId");

-- CreateIndex
CREATE INDEX "GroupChatMute_channelType_channelId_idx" ON "GroupChatMute"("channelType", "channelId");

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMute" ADD CONSTRAINT "GroupChatMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMute" ADD CONSTRAINT "GroupChatMute_mutedById_fkey" FOREIGN KEY ("mutedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

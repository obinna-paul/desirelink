-- CreateIndex
CREATE INDEX "Message_senderId_recipientId_readAt_idx" ON "Message"("senderId", "recipientId", "readAt");

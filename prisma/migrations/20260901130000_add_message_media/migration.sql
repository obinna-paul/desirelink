CREATE TYPE "MessageMediaType" AS ENUM ('image', 'video', 'audio');

ALTER TABLE "Message"
ADD COLUMN "mediaUrl" TEXT,
ADD COLUMN "mediaType" "MessageMediaType",
ADD COLUMN "mediaMimeType" TEXT,
ADD COLUMN "mediaWidth" INTEGER,
ADD COLUMN "mediaHeight" INTEGER,
ADD COLUMN "mediaDurationSeconds" DOUBLE PRECISION;

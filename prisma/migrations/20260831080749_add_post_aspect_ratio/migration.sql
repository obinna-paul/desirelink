-- CreateEnum
CREATE TYPE "PostAspectRatio" AS ENUM ('square', 'portrait', 'full');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "aspectRatio" "PostAspectRatio";

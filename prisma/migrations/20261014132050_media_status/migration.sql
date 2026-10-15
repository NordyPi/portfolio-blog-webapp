-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "status" "MediaStatus" NOT NULL DEFAULT 'READY';

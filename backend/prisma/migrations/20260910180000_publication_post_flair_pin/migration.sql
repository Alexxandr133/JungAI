-- AlterTable
ALTER TABLE "PublicationPost" ADD COLUMN "flair" TEXT;
ALTER TABLE "PublicationPost" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT 0;

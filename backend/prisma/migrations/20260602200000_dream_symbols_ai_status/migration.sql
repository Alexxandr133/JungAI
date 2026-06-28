-- AlterTable
ALTER TABLE "Dream" ADD COLUMN "symbolsStatus" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "Dream" ADD COLUMN "symbolsExtractedAt" DATETIME;
ALTER TABLE "Dream" ADD COLUMN "symbolsAiVersion" INTEGER NOT NULL DEFAULT 0;

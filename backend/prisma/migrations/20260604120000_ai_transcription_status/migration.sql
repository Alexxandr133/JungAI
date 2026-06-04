-- AlterTable
ALTER TABLE "AITranscription" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "AITranscription" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "AITranscription" ADD COLUMN "progressStage" TEXT;
ALTER TABLE "AITranscription" ADD COLUMN "errorMessage" TEXT;

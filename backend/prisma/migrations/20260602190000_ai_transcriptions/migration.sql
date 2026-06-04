-- CreateTable
CREATE TABLE "AITranscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "psychologistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT,
    "durationSec" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "AITranscription_psychologistId_createdAt_idx" ON "AITranscription"("psychologistId", "createdAt");

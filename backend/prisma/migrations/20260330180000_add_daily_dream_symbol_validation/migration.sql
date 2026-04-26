-- CreateTable
CREATE TABLE "DailyDreamSymbolValidation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "day" DATETIME NOT NULL,
  "sourceDreams" INTEGER NOT NULL,
  "rawFrequency" JSONB NOT NULL,
  "cleanedFrequency" JSONB NOT NULL,
  "aiModel" TEXT,
  "aiPromptHash" TEXT,
  "aiResponseRaw" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyDreamSymbolValidation_day_key" ON "DailyDreamSymbolValidation"("day");


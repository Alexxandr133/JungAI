-- Profile catalog / match fields
ALTER TABLE "Profile" ADD COLUMN "sessionPriceRub" INTEGER;
ALTER TABLE "Profile" ADD COLUMN "therapyMethod" TEXT;
ALTER TABLE "Profile" ADD COLUMN "worksWith" JSONB;
ALTER TABLE "Profile" ADD COLUMN "audienceFormats" JSONB;
ALTER TABLE "Profile" ADD COLUMN "calendarPrefs" JSONB;

-- Education history
CREATE TABLE "PsychologistEducation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PsychologistEducation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PsychologistEducation_userId_idx" ON "PsychologistEducation"("userId");

-- Match profile extensions
ALTER TABLE "ClientMatchProfile" ADD COLUMN "whoFor" TEXT NOT NULL DEFAULT 'self';
ALTER TABLE "ClientMatchProfile" ADD COLUMN "customTopic" TEXT;
ALTER TABLE "ClientMatchProfile" ADD COLUMN "preferredSlotStart" DATETIME;
ALTER TABLE "ClientMatchProfile" ADD COLUMN "preferredSlotEnd" DATETIME;
ALTER TABLE "ClientMatchProfile" ADD COLUMN "priceMin" INTEGER;
ALTER TABLE "ClientMatchProfile" ADD COLUMN "priceMax" INTEGER;

-- Questionnaire on client→psychologist requests
ALTER TABLE "SupportRequest" ADD COLUMN "questionnaire" JSONB;

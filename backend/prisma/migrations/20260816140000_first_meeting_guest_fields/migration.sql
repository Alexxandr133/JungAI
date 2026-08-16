-- First-meeting guest fields on Event (SQLite-safe types)
ALTER TABLE "Event" ADD COLUMN "isFirstMeeting" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Event" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Event" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Event" ADD COLUMN "guestQuestionnaire" TEXT;

-- Structured questionnaire on public/match booking requests
ALTER TABLE "CalendarPublicBookingRequest" ADD COLUMN "questionnaire" TEXT;
ALTER TABLE "CalendarPublicBookingRequest" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'slot';

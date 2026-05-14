-- AlterTable
ALTER TABLE "CalendarPublicBookingRequest" ADD COLUMN "declineReason" TEXT;
ALTER TABLE "CalendarPublicBookingRequest" ADD COLUMN "decidedAt" DATETIME;
ALTER TABLE "CalendarPublicBookingRequest" ADD COLUMN "eventId" TEXT;

UPDATE "CalendarPublicBookingRequest" SET "status" = 'pending' WHERE "status" = 'new' OR "status" IS NULL OR "status" = '';

CREATE UNIQUE INDEX "CalendarPublicBookingRequest_eventId_key" ON "CalendarPublicBookingRequest"("eventId");

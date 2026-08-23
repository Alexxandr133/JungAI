-- User.acceptingClients добавляется runtime-хелпером, если колонки ещё нет.
-- Здесь только nullable slotStart для запроса на ведение.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarPublicBookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "psychologistId" TEXT NOT NULL,
    "slotStart" DATETIME,
    "slotEnd" DATETIME,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "message" TEXT,
    "questionnaire" JSONB,
    "source" TEXT NOT NULL DEFAULT 'slot',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "declineReason" TEXT,
    "decidedAt" DATETIME,
    "eventId" TEXT
);
INSERT INTO "new_CalendarPublicBookingRequest" ("contactEmail", "contactName", "contactPhone", "createdAt", "decidedAt", "declineReason", "eventId", "id", "message", "psychologistId", "questionnaire", "slotEnd", "slotStart", "source", "status")
SELECT "contactEmail", "contactName", "contactPhone", "createdAt", "decidedAt", "declineReason", "eventId", "id", "message", "psychologistId", "questionnaire", "slotEnd", "slotStart", "source", "status" FROM "CalendarPublicBookingRequest";
DROP TABLE "CalendarPublicBookingRequest";
ALTER TABLE "new_CalendarPublicBookingRequest" RENAME TO "CalendarPublicBookingRequest";
CREATE UNIQUE INDEX "CalendarPublicBookingRequest_eventId_key" ON "CalendarPublicBookingRequest"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

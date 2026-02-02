-- CreateTable
CREATE TABLE "VoiceRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VoiceRoom_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceRoom_eventId_key" ON "VoiceRoom"("eventId");
CREATE UNIQUE INDEX "VoiceRoom_roomId_key" ON "VoiceRoom"("roomId");

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "sessionStatus" TEXT;
ALTER TABLE "Event" ADD COLUMN "sessionDeclineComment" TEXT;


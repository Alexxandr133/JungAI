-- AlterTable
ALTER TABLE "Dream" ADD COLUMN "clientId" TEXT;

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DreamAmplification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dreamId" TEXT NOT NULL,
    "amplificationId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DreamAmplification_dreamId_fkey" FOREIGN KEY ("dreamId") REFERENCES "Dream" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DreamAmplification_amplificationId_fkey" FOREIGN KEY ("amplificationId") REFERENCES "Amplification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeNote" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "TherapySession" ADD COLUMN "eventId" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "topics" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "techniques" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "homework" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "nextFocus" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "moodBefore" TEXT;
ALTER TABLE "TherapySession" ADD COLUMN "moodAfter" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DreamAmplification_dreamId_amplificationId_key" ON "DreamAmplification"("dreamId", "amplificationId");

-- CreateIndex
CREATE INDEX "Dream_clientId_idx" ON "Dream"("clientId");
CREATE INDEX "TestResult_clientId_idx" ON "TestResult"("clientId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "FileAttachment_entityType_entityId_idx" ON "FileAttachment"("entityType", "entityId");


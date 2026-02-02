-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "psychologistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allowWorkAreaAccess" BOOLEAN NOT NULL DEFAULT 0,
    "clientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminResponse" TEXT,
    "respondedBy" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);


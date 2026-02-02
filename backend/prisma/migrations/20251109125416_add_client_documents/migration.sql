-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "tabName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientDocument_clientId_tabName_psychologistId_key" ON "ClientDocument"("clientId", "tabName", "psychologistId");

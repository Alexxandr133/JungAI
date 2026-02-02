-- AlterTable
ALTER TABLE "Client" ADD COLUMN "registrationToken" TEXT;
ALTER TABLE "Client" ADD COLUMN "tokenExpiresAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Client_registrationToken_key" ON "Client"("registrationToken");

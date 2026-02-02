-- AlterTable
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "bio" TEXT;
ALTER TABLE "Profile" ADD COLUMN "specialization" TEXT;
ALTER TABLE "Profile" ADD COLUMN "experience" TEXT;

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_userId_key" ON "VerificationRequest"("userId");


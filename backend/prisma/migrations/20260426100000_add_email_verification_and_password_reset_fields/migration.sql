ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "emailVerificationCode" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "passwordResetCode" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" DATETIME;

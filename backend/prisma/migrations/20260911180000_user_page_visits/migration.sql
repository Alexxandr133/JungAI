-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" DATETIME;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserPageVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pathKey" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User"("lastSeenAt");
CREATE INDEX IF NOT EXISTS "UserPageVisit_userId_startedAt_idx" ON "UserPageVisit"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "UserPageVisit_pathKey_startedAt_idx" ON "UserPageVisit"("pathKey", "startedAt");
CREATE INDEX IF NOT EXISTS "UserPageVisit_startedAt_idx" ON "UserPageVisit"("startedAt");

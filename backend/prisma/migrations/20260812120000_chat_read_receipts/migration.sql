-- Chat read receipts (SQLite-compatible DATETIME, not TIMESTAMP(3))
-- If upgrading an existing DB that already has broken TIMESTAMP(3) columns:
--   ALTER TABLE "ChatMessage" DROP COLUMN "readAt";
--   ALTER TABLE "ChatMessage" ADD COLUMN "readAt" DATETIME;

ALTER TABLE "ChatMessage" ADD COLUMN "readAt" DATETIME;

CREATE TABLE IF NOT EXISTS "ChatRoomRead" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRoomRead_pkey" PRIMARY KEY ("userId","roomId")
);

CREATE INDEX IF NOT EXISTS "ChatRoomRead_userId_idx" ON "ChatRoomRead"("userId");

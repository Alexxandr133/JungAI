-- Удаляем старые данные из ChatRoom (они не нужны, так как переделываем механику)
DELETE FROM "ChatMessage";
DELETE FROM "ChatRoom";

-- Удаляем старую таблицу ChatRoom
DROP TABLE IF EXISTS "ChatRoom";

-- Создаем новую таблицу ChatRoom с psychologistId и clientId
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "psychologistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Обновляем ChatMessage для связи с новой таблицей
-- (связь уже есть через roomId, просто обновляем внешний ключ)
-- SQLite не требует явного внешнего ключа, но Prisma будет его использовать


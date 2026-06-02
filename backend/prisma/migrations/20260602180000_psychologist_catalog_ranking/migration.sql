-- Ранжирование и видимость психологов в публичном каталоге
ALTER TABLE "User" ADD COLUMN "catalogSortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "catalogHidden" BOOLEAN NOT NULL DEFAULT 0;

-- Начальный порядок по дате регистрации для существующих психологов
UPDATE "User"
SET "catalogSortOrder" = (
  SELECT COUNT(*) FROM "User" u2
  WHERE u2."role" = 'psychologist'
    AND (
      u2."createdAt" < "User"."createdAt"
      OR (u2."createdAt" = "User"."createdAt" AND u2."id" < "User"."id")
    )
)
WHERE "role" = 'psychologist';

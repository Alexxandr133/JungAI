-- Черновики обновлений платформы + совместимость с существующими строками
ALTER TABLE "PlatformUpdate" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;

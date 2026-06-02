-- Поля CRM-карточки клиента и архив завершённой терапии
ALTER TABLE "Client" ADD COLUMN "age" INTEGER;
ALTER TABLE "Client" ADD COLUMN "city" TEXT;
ALTER TABLE "Client" ADD COLUMN "tags" TEXT;
ALTER TABLE "Client" ADD COLUMN "therapyEndedAt" DATETIME;

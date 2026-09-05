-- AlterTable
ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Event" ADD COLUMN "recurrence" TEXT;

-- CreateIndex
CREATE INDEX "Event_createdBy_seriesId_idx" ON "Event"("createdBy", "seriesId");
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

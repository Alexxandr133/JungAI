-- Client self-booking vs psychologist invite: who must confirm next
ALTER TABLE "Event" ADD COLUMN "clientRequestedSession" BOOLEAN NOT NULL DEFAULT false;

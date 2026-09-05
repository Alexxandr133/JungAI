import { randomBytes } from 'crypto';
import { prisma } from '../db/prisma';

function addWeeks(d: Date, weeks: number): Date {
  const n = new Date(d.getTime());
  n.setDate(n.getDate() + weeks * 7);
  return n;
}

export function newSeriesId(): string {
  return randomBytes(12).toString('hex');
}

function generateRoomId(): string {
  return randomBytes(16).toString('hex');
}

export async function ensureEventSeriesColumns(): Promise<void> {
  const cols = async (col: string, ddl: string) => {
    try {
      const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("Event")`)) as any[];
      if (!rows.some((r) => r.name === col)) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Event" ADD COLUMN ${ddl}`);
      }
    } catch (e) {
      console.warn(`[events] ensure column Event.${col}:`, (e as Error)?.message || e);
    }
  };
  await cols('seriesId', '"seriesId" TEXT');
  await cols('recurrence', '"recurrence" TEXT');
}

async function stampSeries(eventId: string, seriesId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Event" SET "seriesId" = ?, "recurrence" = 'weekly' WHERE "id" = ?`,
    seriesId,
    eventId
  );
}

async function createOneWeekly(opts: {
  title: string;
  type: string;
  description: string | null;
  createdBy: string;
  clientId: string | null;
  sessionStatus: string | null;
  startsAt: Date;
  endsAt: Date | null;
  seriesId: string;
}) {
  const roomId = generateRoomId();
  const event = await prisma.event.create({
    data: {
      title: opts.title,
      type: opts.type,
      description: opts.description,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      createdBy: opts.createdBy,
      clientId: opts.clientId,
      sessionStatus: opts.sessionStatus,
      voiceRoom: {
        create: { roomId, roomUrl: `/room/${roomId}` }
      }
    } as any,
    include: { voiceRoom: true }
  });
  await stampSeries(event.id, opts.seriesId);
  if (opts.clientId && opts.type === 'session') {
    try {
      await prisma.therapySession.create({
        data: {
          clientId: opts.clientId,
          date: opts.startsAt,
          summary: opts.description || opts.title,
          videoUrl: null,
          eventId: event.id
        }
      });
    } catch (e) {
      console.warn('Failed to create TherapySession for weekly event', e);
    }
  }
  return { ...event, seriesId: opts.seriesId, recurrence: 'weekly' };
}

export async function findClientWeeklyEvent(createdBy: string, clientId: string): Promise<{ id: string } | null> {
  await ensureEventSeriesColumns();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "Event" WHERE "createdBy" = ? AND "clientId" = ? AND "recurrence" = 'weekly' ORDER BY "startsAt" DESC LIMIT 1`,
    createdBy,
    clientId
  );
  return rows?.[0] || null;
}

export async function createWeeklySeries(opts: {
  title: string;
  type: string;
  description?: string | null;
  createdBy: string;
  clientId?: string | null;
  startsAt: Date;
  endsAt: Date | null;
}): Promise<{ first: any; count: number; seriesId: string }> {
  await ensureEventSeriesColumns();
  const seriesId = newSeriesId();
  const first = await createOneWeekly({
    title: opts.title,
    type: opts.type,
    description: opts.description ?? null,
    createdBy: opts.createdBy,
    clientId: opts.clientId ?? null,
    sessionStatus: opts.clientId ? 'pending' : null,
    startsAt: opts.startsAt,
    endsAt: opts.endsAt,
    seriesId
  });
  return { first, count: 1, seriesId };
}

export async function attachSeriesMeta<T extends { id: string }>(
  events: T[]
): Promise<Array<T & { seriesId: string | null; recurrence: string | null }>> {
  if (!events.length) return events.map((e) => ({ ...e, seriesId: null, recurrence: null }));
  await ensureEventSeriesColumns();
  const placeholders = events.map(() => '?').join(',');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; seriesId: string | null; recurrence: string | null }>>(
    `SELECT "id", "seriesId", "recurrence" FROM "Event" WHERE "id" IN (${placeholders})`,
    ...events.map((e) => e.id)
  );
  const map = new Map(rows.map((r) => [r.id, r]));
  return events.map((e) => {
    const extra = map.get(e.id);
    return { ...e, seriesId: extra?.seriesId ?? null, recurrence: extra?.recurrence ?? null };
  });
}

export async function readEventSeries(id: string): Promise<{ seriesId: string | null; recurrence: string | null }> {
  await ensureEventSeriesColumns();
  const rows = await prisma.$queryRawUnsafe<Array<{ seriesId: string | null; recurrence: string | null }>>(
    `SELECT "seriesId", "recurrence" FROM "Event" WHERE "id" = ? LIMIT 1`,
    id
  );
  return { seriesId: rows?.[0]?.seriesId ?? null, recurrence: rows?.[0]?.recurrence ?? null };
}

/** Одна запись на серию: лишние экземпляры убираем, прошедшую сдвигаем на следующую неделю. */
export async function ensureSeriesHorizon(userId: string): Promise<void> {
  await ensureEventSeriesColumns();
  const seriesRows = await prisma.$queryRawUnsafe<Array<{ seriesId: string }>>(
    `SELECT DISTINCT "seriesId" FROM "Event" WHERE "createdBy" = ? AND "recurrence" = 'weekly' AND "seriesId" IS NOT NULL`,
    userId
  );
  const now = Date.now();

  for (const row of seriesRows || []) {
    const seriesId = row.seriesId;
    if (!seriesId) continue;
    const members = await prisma.$queryRawUnsafe<Array<{ id: string; startsAt: string }>>(
      `SELECT "id", "startsAt" FROM "Event" WHERE "seriesId" = ? ORDER BY "startsAt" ASC`,
      seriesId
    );
    if (!members?.length) continue;

    const withTs = members.map((m) => ({ id: m.id, ts: new Date(m.startsAt).getTime() }));
    const future = withTs.filter((m) => m.ts >= now - 12 * 3600000);
    const keepId = (future[0] || withTs[withTs.length - 1]).id;

    for (const m of withTs) {
      if (m.id === keepId) continue;
      try {
        await prisma.therapySession.deleteMany({ where: { eventId: m.id } });
        await prisma.event.delete({ where: { id: m.id } });
      } catch (e) {
        console.warn('Failed to collapse extra weekly event', m.id, e);
      }
    }

    const keep = await prisma.event.findUnique({ where: { id: keepId } });
    if (!keep) continue;
    const start0 = new Date(keep.startsAt);
    const end0 = keep.endsAt ? new Date(keep.endsAt) : new Date(start0.getTime() + 60 * 60 * 1000);
    const dur = Math.max(30 * 60 * 1000, end0.getTime() - start0.getTime());
    let start = start0;
    let end = end0;
    let shifted = false;
    while (end.getTime() < now) {
      start = addWeeks(start, 1);
      end = new Date(start.getTime() + dur);
      shifted = true;
    }
    if (shifted) {
      await prisma.event.update({
        where: { id: keep.id },
        data: { startsAt: start, endsAt: end }
      });
      try {
        await prisma.therapySession.updateMany({
          where: { eventId: keep.id },
          data: { date: start }
        });
      } catch {
        /* optional link */
      }
    }
  }
}

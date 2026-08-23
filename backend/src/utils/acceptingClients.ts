import { prisma } from '../db/prisma';

async function ensureColumn() {
  try {
    const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("User")`)) as any[];
    if (!rows.some((r) => r.name === 'acceptingClients')) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "User" ADD COLUMN "acceptingClients" BOOLEAN NOT NULL DEFAULT 1`
      );
    }
  } catch {
    /* ignore */
  }
}

export async function readAcceptingClients(userId: string): Promise<boolean> {
  await ensureColumn();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ acceptingClients: number | boolean }>>(
      `SELECT "acceptingClients" FROM "User" WHERE "id" = ? LIMIT 1`,
      userId
    );
    const v = rows?.[0]?.acceptingClients;
    return v !== 0 && v !== false;
  } catch {
    return true;
  }
}

export async function writeAcceptingClients(userId: string, value: boolean): Promise<void> {
  await ensureColumn();
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "acceptingClients" = ? WHERE "id" = ?`,
    value ? 1 : 0,
    userId
  );
}

export async function idsWithSearchOff(): Promise<Set<string>> {
  await ensureColumn();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "User" WHERE "acceptingClients" = 0`
    );
    return new Set((rows || []).map((r) => r.id));
  } catch {
    return new Set();
  }
}

export async function acceptingClientsByIds(ids: string[]): Promise<Map<string, boolean>> {
  await ensureColumn();
  const map = new Map<string, boolean>();
  if (!ids.length) return map;
  try {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; acceptingClients: number | boolean }>>(
      `SELECT "id", "acceptingClients" FROM "User" WHERE "id" IN (${placeholders})`,
      ...ids
    );
    for (const r of rows || []) {
      map.set(r.id, r.acceptingClients !== 0 && r.acceptingClients !== false);
    }
  } catch {
    /* default true */
  }
  return map;
}

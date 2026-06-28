import { prisma } from '../db/prisma';
import { extractDreamSymbolsViaAI } from '../services/dreamSymbolExtraction';

const queue = new Set<string>();
let draining = false;

export async function ensureDreamSymbolColumns(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Dream" ADD COLUMN "symbolsStatus" TEXT NOT NULL DEFAULT 'ready'`
    );
  } catch {
    /* column exists */
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dream" ADD COLUMN "symbolsExtractedAt" DATETIME`);
  } catch {
    /* column exists */
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Dream" ADD COLUMN "symbolsAiVersion" INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    /* column exists */
  }
}

/** Зависшие processing (перезапуск сервера, таймаут ИИ) → pending */
export async function reconcileStaleDreamSymbolJobs(staleMinutes = 10): Promise<number> {
  await ensureDreamSymbolColumns();
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Dream" SET "symbolsStatus" = 'pending'
     WHERE "symbolsStatus" = 'processing' AND ("symbolsExtractedAt" IS NULL OR "symbolsExtractedAt" < ?)`,
    cutoff
  );
  return typeof result === 'number' ? result : 0;
}

const CURRENT_SYMBOLS_AI_VERSION = 1;

/** Однократный backfill: все сны без актуальной версии ИИ-символов → pending */
export async function migrateDreamSymbolsToAi(): Promise<number> {
  await ensureDreamSymbolColumns();
  await reconcileStaleDreamSymbolJobs(0);

  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Dream" SET "symbolsStatus" = 'pending', "symbols" = '[]', "symbolsExtractedAt" = NULL
     WHERE COALESCE("symbolsAiVersion", 0) < ? AND "symbolsStatus" != 'processing'`,
    CURRENT_SYMBOLS_AI_VERSION
  );
  return typeof result === 'number' ? result : 0;
}

export function enqueueDreamSymbolExtraction(dreamId: string): void {
  if (!dreamId) return;
  queue.add(dreamId);
  void drainDreamSymbolQueue();
}

async function drainDreamSymbolQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.size > 0) {
      const id = queue.values().next().value as string;
      queue.delete(id);
      await processDreamSymbols(id);
    }
  } finally {
    draining = false;
  }
}

export async function processDreamSymbols(dreamId: string): Promise<string[]> {
  await ensureDreamSymbolColumns();

  const dream = await prisma.dream.findUnique({
    where: { id: dreamId },
    select: { id: true, title: true, content: true },
  });
  if (!dream) return [];

  await prisma.$executeRawUnsafe(
    `UPDATE "Dream" SET "symbolsStatus" = 'processing' WHERE "id" = ?`,
    dreamId
  );

  try {
    const symbols = await extractDreamSymbolsViaAI(dream.title, dream.content);
    if (!symbols.length && String(dream.content || '').trim().length > 40) {
      throw new Error('AI returned empty symbols for non-trivial dream');
    }
    const nowIso = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `UPDATE "Dream" SET "symbols" = ?, "symbolsStatus" = 'ready', "symbolsExtractedAt" = ?, "symbolsAiVersion" = ? WHERE "id" = ?`,
      JSON.stringify(symbols),
      nowIso,
      CURRENT_SYMBOLS_AI_VERSION,
      dreamId
    );
    return symbols;
  } catch (e) {
    console.error('[DreamSymbols] extraction failed', dreamId, e);
    await prisma.$executeRawUnsafe(
      `UPDATE "Dream" SET "symbolsStatus" = 'failed' WHERE "id" = ?`,
      dreamId
    );
    return [];
  }
}

/** Обработка очереди pending (cron / startup) */
export async function processPendingDreamSymbolsBatch(batchSize = 8): Promise<number> {
  await ensureDreamSymbolColumns();

  const rows = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "Dream"
     WHERE "symbolsStatus" IN ('pending', 'failed')
     ORDER BY "createdAt" ASC
     LIMIT ?`,
    batchSize
  )) as Array<{ id: string }>;

  for (const row of rows) {
    await processDreamSymbols(row.id);
  }
  return rows.length;
}

/** Однократный backfill: все сны без даты извлечения → pending */
export async function queueDreamsWithoutAiExtraction(): Promise<number> {
  await ensureDreamSymbolColumns();
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Dream" SET "symbolsStatus" = 'pending'
     WHERE "symbolsExtractedAt" IS NULL AND "symbolsStatus" != 'processing'`
  );
  return typeof result === 'number' ? result : 0;
}

export async function requeueAllDreamsForSymbolExtraction(): Promise<void> {
  await ensureDreamSymbolColumns();
  await prisma.$executeRawUnsafe(
    `UPDATE "Dream" SET "symbolsStatus" = 'pending', "symbolsExtractedAt" = NULL, "symbols" = '[]', "symbolsAiVersion" = 0
     WHERE "symbolsStatus" != 'processing'`
  );
}

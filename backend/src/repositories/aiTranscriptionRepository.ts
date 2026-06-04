import type { AITranscription, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';

const db = prisma as PrismaClient;

export type TranscriptionStatus = 'processing' | 'completed' | 'failed';

export function serializeTranscription(row: AITranscription) {
  return {
    id: row.id,
    title: row.title,
    sourceFileName: row.sourceFileName,
    text: row.text,
    language: row.language,
    durationSec: row.durationSec,
    status: row.status as TranscriptionStatus,
    progressPercent: row.progressPercent,
    progressStage: row.progressStage,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Зависшие processing (перезапуск сервера, обрыв) → failed */
export async function reconcileStaleTranscriptions(psychologistId: string): Promise<void> {
  const staleMin = Number(process.env.AI_TRANSCRIPTION_STALE_MIN ?? '25');
  const minutes = Number.isFinite(staleMin) && staleMin > 0 ? staleMin : 25;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  await db.aITranscription.updateMany({
    where: {
      psychologistId,
      status: 'processing',
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'failed',
      progressStage: 'Прервано',
      errorMessage:
        'Обработка прервана или заняла слишком много времени. Удалите запись и загрузите файл снова.',
    },
  });
}

export async function listAiTranscriptions(
  psychologistId: string,
  take = 200
): Promise<AITranscription[]> {
  await reconcileStaleTranscriptions(psychologistId);
  return db.aITranscription.findMany({
    where: { psychologistId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function createAiTranscription(
  data: Prisma.AITranscriptionCreateInput
): Promise<AITranscription> {
  return db.aITranscription.create({ data });
}

export async function findAiTranscriptionForPsychologist(
  id: string,
  psychologistId: string
): Promise<AITranscription | null> {
  return db.aITranscription.findFirst({
    where: { id, psychologistId },
  });
}

export async function deleteAiTranscription(id: string): Promise<AITranscription> {
  return db.aITranscription.delete({ where: { id } });
}

export async function updateAiTranscriptionTitle(
  id: string,
  psychologistId: string,
  title: string
): Promise<AITranscription | null> {
  const row = await findAiTranscriptionForPsychologist(id, psychologistId);
  if (!row) return null;
  return db.aITranscription.update({
    where: { id },
    data: { title },
  });
}

export async function updateAiTranscriptionProgress(
  id: string,
  psychologistId: string,
  data: { progressPercent: number; progressStage?: string }
): Promise<void> {
  await db.aITranscription.updateMany({
    where: { id, psychologistId, status: 'processing' },
    data: {
      progressPercent: Math.max(0, Math.min(100, Math.round(data.progressPercent))),
      progressStage: data.progressStage ?? undefined,
    },
  });
}

export async function completeAiTranscription(
  id: string,
  psychologistId: string,
  data: {
    text: string;
    language?: string | null;
    durationSec?: number | null;
  }
): Promise<AITranscription | null> {
  const row = await findAiTranscriptionForPsychologist(id, psychologistId);
  if (!row) return null;
  return db.aITranscription.update({
    where: { id },
    data: {
      text: data.text,
      language: data.language ?? null,
      durationSec: data.durationSec ?? null,
      status: 'completed',
      progressPercent: 100,
      progressStage: 'Готово',
      errorMessage: null,
    },
  });
}

export async function failAiTranscription(
  id: string,
  psychologistId: string,
  errorMessage: string
): Promise<AITranscription | null> {
  const row = await findAiTranscriptionForPsychologist(id, psychologistId);
  if (!row) return null;
  return db.aITranscription.update({
    where: { id },
    data: {
      status: 'failed',
      progressPercent: row.progressPercent,
      progressStage: 'Ошибка',
      errorMessage: errorMessage.slice(0, 2000),
    },
  });
}

import { prisma } from '../db/prisma';

export async function ensurePlatformSettingTable(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "PlatformSetting" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL)'
  );
}

export async function getPlatformSetting(key: string): Promise<string | null> {
  await ensurePlatformSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
    'SELECT "value" FROM "PlatformSetting" WHERE "key" = ? LIMIT 1',
    key
  );
  return rows?.[0]?.value ?? null;
}

export async function setPlatformSetting(key: string, value: string): Promise<void> {
  await ensurePlatformSettingTable();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "PlatformSetting" ("key","value") VALUES (?,?) ON CONFLICT("key") DO UPDATE SET "value"=excluded."value"',
    key,
    value
  );
}

export type TranscriptionModelPreset = {
  id: string;
  label: string;
  strategy: 'stt-first' | 'chat-first';
};

export const PLATFORM_TRANSCRIPTION_PRESETS: TranscriptionModelPreset[] = [
  {
    id: 'openai/whisper-large-v3',
    label: 'Whisper Large v3 — дословная транскрибация, лучше для записей 1–3 ч',
    strategy: 'stt-first',
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash — разметка спикеров (короткие и средние записи)',
    strategy: 'chat-first',
  },
];

export function isAllowedTranscriptionModel(modelId: string): boolean {
  return PLATFORM_TRANSCRIPTION_PRESETS.some((p) => p.id === modelId);
}

export function resolveTranscriptionPreset(modelId: string): TranscriptionModelPreset {
  return (
    PLATFORM_TRANSCRIPTION_PRESETS.find((p) => p.id === modelId) ?? PLATFORM_TRANSCRIPTION_PRESETS[0]
  );
}

export async function getPlatformTranscriptionModel(): Promise<string> {
  const fromDb = await getPlatformSetting('ai_transcription_model');
  if (fromDb && isAllowedTranscriptionModel(fromDb)) {
    return fromDb;
  }

  const sttEnv = (process.env.AI_TRANSCRIPTION_MODEL || '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  if (sttEnv && isAllowedTranscriptionModel(sttEnv)) {
    return sttEnv;
  }

  const chatEnv = (process.env.AI_TRANSCRIPTION_CHAT_MODEL || '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  if (chatEnv && isAllowedTranscriptionModel(chatEnv)) {
    return chatEnv;
  }

  return 'google/gemini-2.5-flash';
}

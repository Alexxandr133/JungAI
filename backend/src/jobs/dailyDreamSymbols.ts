import crypto from 'crypto';
import { OpenAI } from 'openai';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { symbolKey } from '../utils/dreamKeywords';

type SymbolCountRow = { symbol: string; count: number };

function getDayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDayEnd(dayStart: Date): Date {
  const x = new Date(dayStart);
  x.setDate(x.getDate() + 1);
  return x;
}

function parseSymbolsField(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string').map((x) => String(x));
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t);
      return parseSymbolsField(j);
    } catch {
      return t.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function buildRawFrequencyByDreamPresence(dreams: Array<{ symbols: unknown }>): Map<string, number> {
  const freq = new Map<string, number>();

  for (const d of dreams) {
    const seen = new Set<string>();
    for (const s of parseSymbolsField(d.symbols)) {
      const k = symbolKey(s);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }

  return freq;
}

function topNFromMap(freq: Map<string, number>, limit: number): SymbolCountRow[] {
  return [...freq.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol, 'ru'))
    .slice(0, limit);
}

function stablePromptHash(prompt: string): string {
  return crypto.createHash('sha256').update(prompt, 'utf8').digest('hex').slice(0, 16);
}

async function ensureDailyValidationTable() {
  // В проекте уже есть "битая" история миграций, поэтому делаем мягкую self-healing и создаем таблицу на лету.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyDreamSymbolValidation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "day" TEXT NOT NULL UNIQUE,
      "sourceDreams" INTEGER NOT NULL,
      "rawFrequency" TEXT NOT NULL,
      "cleanedFrequency" TEXT NOT NULL,
      "aiModel" TEXT,
      "aiPromptHash" TEXT,
      "aiResponseRaw" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
  `);
}

async function upsertDailyValidationRow(input: {
  day: Date;
  sourceDreams: number;
  rawFrequency: SymbolCountRow[];
  cleanedFrequency: SymbolCountRow[];
  aiModel: string | null;
  aiPromptHash: string | null;
  aiResponseRaw: string | null;
}) {
  await ensureDailyValidationTable();
  const nowIso = new Date().toISOString();
  const dayIso = input.day.toISOString();

  const id = crypto.randomUUID();
  const raw = JSON.stringify(input.rawFrequency ?? []);
  const cleaned = JSON.stringify(input.cleanedFrequency ?? []);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "DailyDreamSymbolValidation"
      ("id","day","sourceDreams","rawFrequency","cleanedFrequency","aiModel","aiPromptHash","aiResponseRaw","createdAt","updatedAt")
    VALUES
      (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT("day") DO UPDATE SET
      "sourceDreams"=excluded."sourceDreams",
      "rawFrequency"=excluded."rawFrequency",
      "cleanedFrequency"=excluded."cleanedFrequency",
      "aiModel"=excluded."aiModel",
      "aiPromptHash"=excluded."aiPromptHash",
      "aiResponseRaw"=excluded."aiResponseRaw",
      "updatedAt"=excluded."updatedAt"
    `,
    id,
    dayIso,
    input.sourceDreams,
    raw,
    cleaned,
    input.aiModel,
    input.aiPromptHash,
    input.aiResponseRaw,
    nowIso,
    nowIso
  );

  const rows = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT "day","sourceDreams","cleanedFrequency" FROM "DailyDreamSymbolValidation" WHERE "day" = ? LIMIT 1`,
    dayIso
  )) as any[];
  const row = rows?.[0];

  return {
    day: new Date(row?.day ?? dayIso),
    sourceDreams: Number(row?.sourceDreams ?? input.sourceDreams),
    cleanedFrequency: JSON.parse(String(row?.cleanedFrequency ?? cleaned)) as SymbolCountRow[]
  };
}

function buildTagNormalizationPrompt(input: {
  dateLabel: string;
  candidates: SymbolCountRow[];
}): { system: string; user: string; promptHash: string } {
  const system = [
    'Ты — модуль нормализации "символов сна" для русскоязычного приложения Аналитической психологии.',
    'Тебе дают список ТЕГОВ (коротких слов/фраз), уже извлеченных ранее, с их частотой (в скольких снах за день встречался тег).',
    '',
    'Твоя задача: привести теги к "адекватному" смысловому виду, НЕ читая тексты снов.',
    'Нужно:',
    '- склеить формы и синонимы в один канон (копики/менты/полиция -> Полиция; фсбшники/фсб -> ФСБ; обыскать/обыскивать/досмотр -> обыск; бежать/убежать -> бег)',
    '- удалить мусорные/служебные/сравнительные/местоименные/глагольные слова (вместо, всех, дальше, сделать, начать и т.п.)',
    '- не придумывать новых тегов, которых нет во входных данных (кроме канонов-склеек, которые являются нормализацией входных)',
    '- не пытаться интерпретировать психологически; только нормализация слов.',
    '',
    'Формат ответа: СТРОГО JSON без пояснений и без markdown.',
    'JSON-схема:',
    '{',
    '  "keep": [ { "canon": string, "variants": string[] } ],',
    '  "drop": string[]',
    '}',
    '',
    'Правила:',
    '- "canon" должен быть коротким (1-2 слова), с нормальной капитализацией (например "ФСБ", "Полиция", "обыск").',
    '- "variants" — список входных тегов, которые нужно склеить в этот canon (строки как во входе).',
    '- В "drop" перечисли входные теги, которые нужно выкинуть.',
    '- Каждый входной тег должен оказаться либо в одном из keep[*].variants, либо в drop.',
    ''
  ].join('\n');

  const user = [
    `Дата: ${input.dateLabel}`,
    'Входные теги (symbol) и их частота (count):',
    JSON.stringify(input.candidates, null, 2)
  ].join('\n');

  const promptHash = stablePromptHash(`${system}\n\n${user}`);
  return { system, user, promptHash };
}

function makeAiClient() {
  if (!config.hfToken) return null;
  // HF Router: OpenAI-compatible
  return new OpenAI({ baseURL: 'https://router.huggingface.co/v1', apiKey: config.hfToken });
}

function getModelName(): string {
  // можно переопределять в .env, а позже переключить на OpenRouter
  return process.env.TAG_VALIDATOR_MODEL || 'deepseek-ai/DeepSeek-V3:novita';
}

function tryParseJsonObject(raw: string): any | null {
  const t = (raw || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    // попытка вытащить JSON из текста (если модель всё же добавила лишнее)
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export async function runDailyDreamSymbolValidation(opts?: { forDate?: Date; limitCandidates?: number }) {
  const now = new Date();
  const dayStart = getDayStart(opts?.forDate ?? now);
  const dayEnd = getDayEnd(dayStart);

  const dreams = await prisma.dream.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
    select: { symbols: true }
  });

  const freq = buildRawFrequencyByDreamPresence(dreams);
  const rawTop = topNFromMap(freq, Math.max(50, opts?.limitCandidates ?? 60));

  // Если нет данных — всё равно пишем запись, чтобы фронт не дергал AI
  if (rawTop.length === 0) {
    const empty: SymbolCountRow[] = [];
    return await upsertDailyValidationRow({
      day: dayStart,
      sourceDreams: dreams.length,
      rawFrequency: empty,
      cleanedFrequency: empty,
      aiModel: null,
      aiPromptHash: null,
      aiResponseRaw: null
    });
  }

  const ai = makeAiClient();
  if (!ai) {
    // Без токена просто сохраняем "как есть"
    return await upsertDailyValidationRow({
      day: dayStart,
      sourceDreams: dreams.length,
      rawFrequency: rawTop,
      cleanedFrequency: rawTop.slice(0, 10),
      aiModel: null,
      aiPromptHash: null,
      aiResponseRaw: null
    });
  }

  const { system, user, promptHash } = buildTagNormalizationPrompt({
    dateLabel: dayStart.toLocaleDateString('ru-RU'),
    candidates: rawTop
  });

  const model = getModelName();
  const completion = await ai.chat.completions.create(
    {
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    },
    { timeout: 120000 }
  );

  const rawText = completion.choices[0]?.message?.content || '';
  const parsed = tryParseJsonObject(rawText);

  // fallback: если модель сломалась — сохраняем rawTop как cleaned
  if (!parsed || !Array.isArray(parsed.keep) || !Array.isArray(parsed.drop)) {
    return await upsertDailyValidationRow({
      day: dayStart,
      sourceDreams: dreams.length,
      rawFrequency: rawTop,
      cleanedFrequency: rawTop.slice(0, 10),
      aiModel: model,
      aiPromptHash: promptHash,
      aiResponseRaw: rawText
    });
  }

  const variantToCanon = new Map<string, string>();
  const drop = new Set<string>((parsed.drop as any[]).filter((x) => typeof x === 'string').map((x) => symbolKey(x)));

  for (const row of parsed.keep as any[]) {
    const canon = typeof row?.canon === 'string' ? row.canon.trim() : '';
    const variants: string[] = Array.isArray(row?.variants) ? row.variants.filter((x: any) => typeof x === 'string') : [];
    if (!canon || variants.length === 0) continue;
    for (const v of variants) {
      const k = symbolKey(v);
      if (!k) continue;
      variantToCanon.set(k, canon);
    }
  }

  const cleanedFreq = new Map<string, number>();
  for (const [variant, count] of freq.entries()) {
    if (drop.has(variant)) continue;
    const canon = variantToCanon.get(variant) ?? variant;
    cleanedFreq.set(canon, (cleanedFreq.get(canon) ?? 0) + count);
  }

  const cleanedTop = topNFromMap(
    new Map([...cleanedFreq.entries()].map(([k, v]) => [k, v])),
    10
  );

  return await upsertDailyValidationRow({
    day: dayStart,
    sourceDreams: dreams.length,
    rawFrequency: rawTop,
    cleanedFrequency: cleanedTop,
    aiModel: model,
    aiPromptHash: promptHash,
    aiResponseRaw: rawText
  });
}


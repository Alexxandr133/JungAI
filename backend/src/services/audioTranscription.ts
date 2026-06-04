import { config } from '../config';
import {
  chunkThresholdBytes,
  getFfmpegPath,
  shouldChunkAudio,
  splitAudioBuffer,
} from './audioChunking';

/** Лимит загрузки (МБ): 0 или не задано = без лимита (практически 4 ГБ) */
function resolveTranscriptionMaxBytes(): number {
  const mb = Number(process.env.AI_TRANSCRIPTION_MAX_MB ?? '0');
  if (!Number.isFinite(mb) || mb <= 0) {
    return 4 * 1024 * 1024 * 1024;
  }
  return Math.floor(mb * 1024 * 1024);
}

export const AI_TRANSCRIPTION_MAX_BYTES = resolveTranscriptionMaxBytes();

export function transcriptionTimeoutMs(byteLength: number): number {
  const fromEnv = Number(process.env.AI_TRANSCRIPTION_TIMEOUT_MS);
  const base = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 600_000;
  const perMb = 120_000;
  const mb = byteLength / (1024 * 1024);
  const computed = Math.floor(base + mb * perMb);
  return Math.min(3_600_000, Math.max(base, computed));
}
const TRANSCRIPTION_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const CHUNK_PAUSE_MS = 6000;
const RATE_LIMIT_RETRY_MS = 45_000;

const DEFAULT_LANGUAGE = () => (process.env.AI_TRANSCRIPTION_LANGUAGE || 'ru').trim();

/** chat-first — Gemini/audio в chat (работает при 403 на OpenAI STT); stt-first — классический /audio/transcriptions */
const TRANSCRIPTION_STRATEGY = (): 'chat-first' | 'stt-first' => {
  const s = (process.env.AI_TRANSCRIPTION_STRATEGY || 'chat-first').trim().toLowerCase();
  return s === 'stt-first' || s === 'stt' ? 'stt-first' : 'chat-first';
};

/** Модели для /audio/transcriptions (по порядку) */
const STT_MODEL_CANDIDATES = (): string[] => {
  const fromEnv = (process.env.AI_TRANSCRIPTION_MODEL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = ['openai/whisper-large-v3'];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...fromEnv, ...defaults]) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
};

/** Fallback: chat/completions + input_audio (если STT endpoint даёт 403) */
const CHAT_AUDIO_MODEL_CANDIDATES = (): string[] => {
  const fromEnv = (process.env.AI_TRANSCRIPTION_CHAT_MODEL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = ['google/gemini-2.5-flash', 'openai/gpt-4o-mini'];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [...fromEnv, ...defaults]) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
};

const AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'video/mp4',
  'video/webm',
]);

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase().replace('.', '') : '';
}

export function isAllowedTranscriptionAudio(mime: string, originalname: string): boolean {
  const m = (mime || '').toLowerCase();
  if (AUDIO_MIMES.has(m)) return true;
  const ext = extOf(originalname);
  return ['mp3', 'wav', 'webm', 'ogg', 'opus', 'flac', 'm4a', 'mp4', 'aac', 'mpeg'].includes(ext);
}

export function openRouterAudioFormat(mime: string, originalname: string): string {
  const ext = extOf(originalname);
  const m = (mime || '').toLowerCase();
  if (ext === 'mp3' || m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (ext === 'wav' || m.includes('wav')) return 'wav';
  if (ext === 'webm' || m.includes('webm')) return 'webm';
  if (ext === 'ogg' || m.includes('ogg')) return 'ogg';
  if (ext === 'opus' || m.includes('opus')) return 'ogg';
  if (ext === 'flac' || m.includes('flac')) return 'flac';
  if (ext === 'm4a' || m.includes('m4a')) return 'm4a';
  if (ext === 'mp4' || m.includes('mp4')) return 'mp4';
  if (ext === 'aac' || m.includes('aac')) return 'aac';
  return ext || 'mp3';
}

/** Варианты format для chat/completions (Gemini иногда отклоняет mp3, но принимает mpeg/m4a) */
function chatAudioFormatHints(declared: string): string[] {
  const d = declared.toLowerCase();
  const byFormat: Record<string, string[]> = {
    mp3: ['mp3', 'mpeg', 'm4a'],
    mpeg: ['mpeg', 'mp3', 'm4a'],
    ogg: ['ogg', 'opus'],
    opus: ['opus', 'ogg'],
    m4a: ['m4a', 'mp4', 'mp3'],
    mp4: ['mp4', 'm4a'],
    webm: ['webm'],
    wav: ['wav'],
    flac: ['flac'],
    aac: ['aac', 'm4a'],
  };
  const list = byFormat[d] || [d];
  const seen = new Set<string>();
  return list.filter((f) => {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });
}

function isSkippableChatError(status: number, error: string): boolean {
  if (status === 404 || status === 400 || status === 422) return true;
  const low = error.toLowerCase();
  return (
    low.includes('no endpoints found') ||
    low.includes('not found') ||
    low.includes('не вернула текст') ||
    low.includes('транскрибация пуста')
  );
}

export type TranscriptionApiResult = {
  text: string;
  durationSec?: number;
  language?: string;
  modelUsed?: string;
};

export type TranscriptionProgressUpdate = {
  percent: number;
  stage: string;
};

async function emitProgress(
  onProgress: ((u: TranscriptionProgressUpdate) => void | Promise<void>) | undefined,
  percent: number,
  stage: string
): Promise<void> {
  if (!onProgress) return;
  await onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), stage });
}

function getApiKey(): string {
  const apiKey = config.openRouterApiKey || config.hfToken;
  if (!apiKey) {
    throw new Error('OpenRouter API не настроен. Установите OPENROUTER_API_KEY.');
  }
  return apiKey;
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.openRouterSiteUrl) headers['HTTP-Referer'] = config.openRouterSiteUrl;
  if (config.openRouterSiteName) headers['X-OpenRouter-Title'] = config.openRouterSiteName;
  return headers;
}

function parseApiError(json: any, raw: string, status: number): string {
  const inner =
    json?.error?.message ||
    json?.error?.metadata?.raw ||
    json?.error ||
    json?.message;
  if (inner) return String(inner);
  if (raw?.trim()) return raw.slice(0, 500);
  return `Ошибка транскрибации (${status})`;
}

function isProviderBlockedStatus(status: number): boolean {
  return status === 403 || status === 402;
}

function isTransientGatewayStatus(status: number, error: string): boolean {
  if (status === 502 || status === 503 || status === 524 || status === 529) return true;
  const low = error.toLowerCase();
  return low.includes('bad gateway') || low.includes('cloudflare') || low.includes('origin_bad_gateway');
}

function isProviderBlockedError(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes('provider returned 403') ||
    low.includes('provider returned 402') ||
    low.includes('payment required')
  );
}

function isRateLimitedStatus(status: number, error: string): boolean {
  if (status === 429) return true;
  const low = error.toLowerCase();
  return low.includes('rate limit') || low.includes('too many requests') || low.includes('429');
}

function isRetryableNetworkError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || (error as any)?.cause?.code || '').toUpperCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userFacing403Hint(): string {
  return (
    'Провайдер OpenRouter отклонил транскрибацию (403). Проверьте баланс на https://openrouter.ai/credits ' +
    'и что ключ имеет доступ к Audio API. В .env можно указать AI_TRANSCRIPTION_MODEL=openai/whisper-large-v3 ' +
    'или AI_TRANSCRIPTION_CHAT_MODEL=google/gemini-2.5-flash для запасного режима.'
  );
}

async function postStt(
  apiKey: string,
  model: string,
  base64: string,
  format: string,
  language: string,
  timeoutMs: number
): Promise<{ ok: true; result: TranscriptionApiResult } | { ok: false; status: number; error: string }> {
  const body: Record<string, unknown> = {
    model,
    input_audio: { data: base64, format },
    language,
    provider: {
      allow_fallbacks: true,
    },
  };

  const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* ignore */
  }

  if (res.ok) {
    const text = String(json?.text || '').trim();
    if (!text) {
      return { ok: false, status: res.status, error: 'Транскрибация пуста. Проверьте качество записи.' };
    }
    return {
      ok: true,
      result: {
        text,
        durationSec: typeof json?.usage?.seconds === 'number' ? json.usage.seconds : undefined,
        language: typeof json?.language === 'string' ? json.language : language,
        modelUsed: model,
      },
    };
  }

  return { ok: false, status: res.status, error: parseApiError(json, raw, res.status) };
}

function isDiarizationEnabled(): boolean {
  const v = (process.env.AI_TRANSCRIPTION_DIARIZE ?? 'true').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no';
}

function chatMaxTokens(): number {
  return isDiarizationEnabled() ? 16_000 : 8_000;
}

function buildTranscriptionPrompt(language: string, partIndex: number, partTotal: number): string {
  const diarize = isDiarizationEnabled();

  if (language === 'ru') {
    if (diarize) {
      const speakerRules =
        'Если говорят несколько человек — помечай каждую реплику: «Спикер 1:», «Спикер 2:», «Спикер 3:» (только если слышно 3+ голоса). ' +
        'Если роли очевидны (терапия/консультация), можно «Психолог:» и «Клиент:». При смене говорящего — новая строка с меткой. ' +
        'Сохраняй дословность; без заголовков markdown и без итогового пересказа.';
      if (partTotal > 1) {
        return (
          `Дословно транскрибируй фрагмент ${partIndex} из ${partTotal} длинной записи на русском. ${speakerRules} ` +
          `Нумерацию спикеров веди последовательно, как в одном разговоре (не сбрасывай на «Спикер 1» в каждом фрагменте без причины).`
        );
      }
      return `Дословно транскрибируй всю запись на русском. ${speakerRules}`;
    }
    if (partTotal > 1) {
      return `Дословно транскрибируй фрагмент ${partIndex} из ${partTotal} длинной аудиозаписи на русском языке. Верни только текст речи этого фрагмента, без пояснений и markdown.`;
    }
    return 'Дословно транскрибируй всё сказанное в аудио на русском языке. Верни только текст речи, без пояснений и markdown.';
  }

  if (diarize) {
    const speakerRules =
      'Label each turn with "Speaker 1:", "Speaker 2:", etc. New line when the speaker changes. Verbatim only, no summary.';
    if (partTotal > 1) {
      return `Transcribe part ${partIndex} of ${partTotal} in "${language}". ${speakerRules} Keep speaker numbering consistent across parts.`;
    }
    return `Transcribe the audio in "${language}". ${speakerRules}`;
  }
  if (partTotal > 1) {
    return `Transcribe part ${partIndex} of ${partTotal} verbatim in "${language}". Return only the spoken text.`;
  }
  return `Transcribe the audio verbatim in language "${language}". Return only the spoken text.`;
}

async function refineStructuredTranscript(
  apiKey: string,
  draft: string,
  language: string,
  partsCount: number
): Promise<string> {
  const model = (process.env.AI_TRANSCRIPTION_REFINE_MODEL || 'google/gemini-2.5-flash').trim();
  const ru = language === 'ru';
  const prompt = ru
    ? `Ниже черновик транскрипции разговора${partsCount > 1 ? ` (собран из ${partsCount} фрагментов)` : ''}.

Приведи к единому читаемому виду:
1. Реплики разных людей — «Спикер 1:», «Спикер 2:», «Спикер 3:» (или «Психолог:»/«Клиент:», если роли ясны).
2. Одна реплика — одна строка с меткой; при смене говорящего — новая строка.
3. Убери дубли и обрывки на стыках фрагментов, не теряй содержание.
4. Дословность сохраняй; без вступлений, без пересказа и без markdown-заголовков.

Верни только итоговый текст.

--- ЧЕРНОВИК ---
${draft}`
    : `Unify this multi-part transcript. Use "Speaker 1:", "Speaker 2:" labels, fix seam duplicates, keep verbatim content. Return only the final text.

--- DRAFT ---
${draft}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 16_000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(900_000),
  });

  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    console.warn('[STT] refine failed, using draft', parseApiError(json, raw, res.status));
    return draft;
  }
  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  return text || draft;
}

async function postChatAudioTranscription(
  apiKey: string,
  model: string,
  base64: string,
  format: string,
  language: string,
  timeoutMs: number,
  partIndex = 1,
  partTotal = 1
): Promise<{ ok: true; result: TranscriptionApiResult } | { ok: false; status: number; error: string }> {
  const prompt = buildTranscriptionPrompt(language, partIndex, partTotal);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: chatMaxTokens(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'input_audio', input_audio: { data: base64, format } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: parseApiError(json, raw, res.status) };
  }

  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    return { ok: false, status: res.status, error: 'Модель не вернула текст транскрибации.' };
  }

  return {
    ok: true,
    result: {
      text,
      language,
      modelUsed: `${model} (chat+audio)`,
    },
  };
}

async function transcribeViaSttEndpoint(
  apiKey: string,
  base64: string,
  format: string,
  language: string,
  timeoutMs: number
): Promise<TranscriptionApiResult | null> {
  const models = STT_MODEL_CANDIDATES();
  let lastError = '';

  const formatHints = chatAudioFormatHints(format);

  for (const model of models) {
    for (const fmt of formatHints) {
      for (let attempt = 1; attempt <= TRANSCRIPTION_MAX_ATTEMPTS; attempt++) {
        try {
          console.log('[STT] transcriptions API', {
            model,
            format: fmt,
            declared: format,
            language,
            attempt,
            base64Len: base64.length,
          });
          const out = await postStt(apiKey, model, base64, fmt, language, timeoutMs);
          if (out.ok) {
            console.log('[STT] success', { model, format: fmt });
            return out.result;
          }
          lastError = out.error;
          console.warn('[STT] failed', { model, format: fmt, status: out.status, error: out.error });
          if (isProviderBlockedStatus(out.status) || isProviderBlockedError(out.error)) {
            console.warn('[STT] provider blocked — skip remaining STT models');
            return null;
          }
          if (out.status !== 429) {
            break;
          }
        } catch (e: any) {
          lastError = e?.message || 'fetch failed';
          if (!isRetryableNetworkError(e) || attempt >= TRANSCRIPTION_MAX_ATTEMPTS) break;
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
  }

  console.warn('[STT] all STT models failed', { lastError });
  return null;
}

async function transcribeViaChatAudio(
  apiKey: string,
  base64: string,
  format: string,
  language: string,
  timeoutMs: number,
  partIndex = 1,
  partTotal = 1
): Promise<TranscriptionApiResult> {
  const models = CHAT_AUDIO_MODEL_CANDIDATES();
  const formatHints = chatAudioFormatHints(format);
  let lastError = userFacing403Hint();

  for (const model of models) {
    for (const fmt of formatHints) {
      for (let attempt = 1; attempt <= TRANSCRIPTION_MAX_ATTEMPTS; attempt++) {
        try {
          console.log('[STT] chat+audio', { model, format: fmt, declared: format, language, attempt });
          const out = await postChatAudioTranscription(
            apiKey,
            model,
            base64,
            fmt,
            language,
            timeoutMs,
            partIndex,
            partTotal
          );
          if (out.ok) {
            console.log('[STT] chat+audio success', { model, format: fmt, partIndex });
            return out.result;
          }
          lastError = out.error;
          console.warn('[STT] chat+audio failed', {
            model,
            format: fmt,
            status: out.status,
            error: out.error.slice(0, 200),
            partIndex,
          });
          if (isProviderBlockedStatus(out.status) || isProviderBlockedError(out.error)) {
            break;
          }
          if (isRateLimitedStatus(out.status, out.error)) {
            if (attempt < TRANSCRIPTION_MAX_ATTEMPTS) {
              await sleep(RATE_LIMIT_RETRY_MS);
              continue;
            }
            throw new Error(
              'Слишком много запросов к AI. Подождите 1–2 минуты и загрузите файл снова.'
            );
          }
          if (isTransientGatewayStatus(out.status, out.error) && attempt < TRANSCRIPTION_MAX_ATTEMPTS) {
            await sleep(RETRY_DELAY_MS * attempt * 2);
            continue;
          }
          if (!isSkippableChatError(out.status, out.error)) {
            break;
          }
        } catch (e: any) {
          lastError = e?.message || lastError;
          console.warn('[STT] chat+audio error', { model, format: fmt, error: lastError, partIndex });
          if (
            (isRetryableNetworkError(e) || String(lastError).toLowerCase().includes('fetch failed')) &&
            attempt < TRANSCRIPTION_MAX_ATTEMPTS
          ) {
            await sleep(RETRY_DELAY_MS * attempt * 2);
            continue;
          }
          break;
        }
      }
    }
  }

  throw new Error(lastError);
}

async function transcribeSingleBuffer(
  buffer: Buffer,
  format: string,
  lang: string,
  partIndex: number,
  partTotal: number
): Promise<TranscriptionApiResult> {
  const apiKey = getApiKey();
  const base64 = buffer.toString('base64');
  const timeoutMs = transcriptionTimeoutMs(buffer.length);
  const strategy = TRANSCRIPTION_STRATEGY();

  if (strategy === 'stt-first') {
    const sttResult = await transcribeViaSttEndpoint(apiKey, base64, format, lang, timeoutMs);
    if (sttResult) return sttResult;
    return transcribeViaChatAudio(apiKey, base64, format, lang, timeoutMs, partIndex, partTotal);
  }

  try {
    return await transcribeViaChatAudio(apiKey, base64, format, lang, timeoutMs, partIndex, partTotal);
  } catch (chatErr: any) {
    console.warn('[STT] chat-first failed, trying STT endpoint', chatErr?.message || chatErr);
    const sttResult = await transcribeViaSttEndpoint(apiKey, base64, format, lang, timeoutMs);
    if (sttResult) return sttResult;
    throw chatErr;
  }
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  format: string,
  language?: string,
  onProgress?: (u: TranscriptionProgressUpdate) => void | Promise<void>
): Promise<TranscriptionApiResult> {
  const lang = (language?.trim() || DEFAULT_LANGUAGE()).slice(0, 10);
  await emitProgress(onProgress, 15, 'Анализ файла');

  let chunks: Buffer[] = [buffer];
  if (shouldChunkAudio(buffer.length)) {
    await emitProgress(onProgress, 18, 'Разделение на части');
    chunks = await splitAudioBuffer(buffer, format);
    if (chunks.length === 1 && buffer.length > chunkThresholdBytes() && !getFfmpegPath()) {
      throw new Error(
        `Файл ${(buffer.length / 1024 / 1024).toFixed(0)} МБ слишком большой для одного запроса к OpenRouter. ` +
          'Установите ffmpeg (npm-пакет ffmpeg-static уже в зависимостях — перезапустите backend после npm install) ' +
          'или укажите FFMPEG_PATH в .env.'
      );
    }
  }

  if (chunks.length === 1) {
    await emitProgress(onProgress, 25, 'Транскрибация');
    const single = await transcribeSingleBuffer(buffer, format, lang, 1, 1);
    await emitProgress(onProgress, 100, 'Готово');
    return single;
  }

  const apiKey = getApiKey();
  const texts: string[] = [];
  let modelUsed = '';
  const total = chunks.length;
  const span = 70;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await sleep(CHUNK_PAUSE_MS);
    }
    const pct = 20 + Math.round(((i + 0.2) / total) * span);
    await emitProgress(onProgress, pct, `Часть ${i + 1} из ${total}`);
    console.log('[STT] transcribing chunk', {
      part: i + 1,
      total,
      mb: (chunks[i].length / 1024 / 1024).toFixed(1),
    });
    const part = await transcribeSingleBuffer(chunks[i], format, lang, i + 1, total);
    const t = part.text.trim();
    if (t) texts.push(t);
    if (part.modelUsed) modelUsed = part.modelUsed;
    await emitProgress(onProgress, 20 + Math.round(((i + 1) / total) * span), `Часть ${i + 1} из ${total}`);
  }

  if (!texts.length) {
    throw new Error('Транскрибация пуста по всем частям записи.');
  }

  let merged = texts.join('\n\n');
  if (isDiarizationEnabled()) {
    await emitProgress(onProgress, 92, 'Разметка спикеров');
    console.log('[STT] refining merged transcript (speakers + seams)');
    merged = await refineStructuredTranscript(apiKey, merged, lang, total);
    if (modelUsed) modelUsed += ' + refine';
  }

  await emitProgress(onProgress, 100, 'Готово');
  return {
    text: merged,
    language: lang,
    modelUsed: modelUsed ? `${modelUsed} (${total} частей)` : `${total} частей`,
  };
}

import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { mergeDreamKeywords } from '../utils/dreamKeywords';
import { config } from '../config';
import { OpenAI } from 'openai';
import { assertAiQuotaAvailable, consumeAiTokens, getAiQuotaStatus } from '../services/aiTokenQuota';
import {
  appendArchetypeLanguageGuard,
  appendPersonalization,
  appendResponseStyle,
  buildClientModalityPrompt,
  buildGeneralModalityPrompt,
  clampAiTemperature,
  getModalityPolicy,
  inferMaxTokensFromResponseStyle,
  normalizePsychologistModality,
  type ResponseStyle
} from '../utils/psychologistAiModality';

type DreamsContextRange = '30d' | '90d' | '365d' | 'all';
const MAX_DREAM_ROWS_BY_RANGE: Record<DreamsContextRange, number> = {
  '30d': 150,
  '90d': 150,
  '365d': 150,
  all: 400
};
const DEFAULT_ESTIMATED_INPUT_COST_PER_1M = 2.0; // USD, rough fallback

function parseDreamsContextRange(raw: unknown): DreamsContextRange {
  const s = String(raw ?? '30d');
  if (s === '30d' || s === '90d' || s === '365d' || s === 'all') return s;
  return '30d';
}

/** Нижняя граница даты createdAt для фильтра снов; null — без ограничения */
function minDateForDreamRange(range: DreamsContextRange): Date | null {
  if (range === 'all') return null;
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function dreamRangeLabelRu(range: DreamsContextRange): string {
  switch (range) {
    case '30d':
      return 'последние 30 дней';
    case '90d':
      return 'последние 90 дней';
    case '365d':
      return 'последний год';
    default:
      return 'всё время';
  }
}

function formatDreamSymbolsForPrompt(symbols: unknown): string {
  if (symbols == null) return '';
  if (Array.isArray(symbols)) return (symbols as string[]).map(String).filter(Boolean).join(', ');
  if (typeof symbols === 'object') return Object.keys(symbols as object).join(', ');
  return '';
}

const router = Router();

/** Режим с данными клиентов: по умолчанию включён; выключен только при явном false (в т.ч. строка из прокси/клиента). */
function parsePsychologistClientModeEnabled(body: unknown): boolean {
  if (!body || typeof body !== 'object') return true;
  const v = (body as Record<string, unknown>).clientModeEnabled;
  if (v === false || v === 'false' || v === 0) return false;
  return true;
}

const apiKey = config.openRouterApiKey || config.hfToken;
// OpenRouter OpenAI-compatible endpoint
const openRouterClient = apiKey ? new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey,
  defaultHeaders: {
    ...(config.openRouterSiteUrl ? { 'HTTP-Referer': config.openRouterSiteUrl } : {}),
    ...(config.openRouterSiteName ? { 'X-OpenRouter-Title': config.openRouterSiteName } : {})
  }
}) : null;

const AI_FALLBACK_MODEL = 'deepseek/deepseek-v3.2';
const DEFAULT_AI_MODEL = config.aiModelDefault || AI_FALLBACK_MODEL;
const REQUIRED_UI_MODELS = [
  'anthropic/claude-sonnet-4.6',
  'deepseek/deepseek-v4-flash',
  'openai/gpt-4o-mini',
  'qwen/qwen3.5-flash-02-23',
  'x-ai/grok-4.3'
];
const ALLOWED_AI_MODELS = new Set(
  [
    ...(config.aiAllowedModels?.length ? config.aiAllowedModels : [DEFAULT_AI_MODEL]),
    ...REQUIRED_UI_MODELS
  ]
    .map((m) => m.trim())
    .filter(Boolean)
);

const OPENROUTER_REQUEST_TIMEOUT_MS = 180000;
const OPENROUTER_NETWORK_RETRY_DELAY_MS = 1200;
const OPENROUTER_MAX_ATTEMPTS_PER_MODEL = 2;
const MAX_CONVERSATION_MESSAGES = 30;
const MAX_HISTORY_MESSAGE_CHARS = 1400;
const MAX_AI_OUTPUT_TOKENS = 15000;
const DREAM_ANALYSIS_MAX_OUTPUT_TOKENS = 15000;

function trimConversationHistory(historyRaw: any[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const safe = (Array.isArray(historyRaw) ? historyRaw : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => {
      const contentRaw = String(m.content);
      const content =
        contentRaw.length > MAX_HISTORY_MESSAGE_CHARS
          ? `${contentRaw.slice(0, MAX_HISTORY_MESSAGE_CHARS)}\n...[сообщение сокращено для скорости]`
          : contentRaw;
      return { role: m.role as 'user' | 'assistant', content };
    });

  return safe.slice(-MAX_CONVERSATION_MESSAGES);
}

function messageLooksLikeDreamAnalysis(textRaw: unknown): boolean {
  const s = String(textRaw || '').toLowerCase();
  const hasDreamKeyword =
    /(сны|снов|снам|снами|снах|сон|сна|сну|сном|dream)/i.test(s) || /\bснф\b/i.test(s);
  const hasAnalyzeIntent =
    /(анализ|проанализ|провалид|валид|разбер|разбор|посмотр|просмотр|просмотри|глянь|оцени|исслед|сводк|паттерн|ревью|проверь)/i.test(s);
  return hasDreamKeyword && hasAnalyzeIntent;
}

function isRetryableOpenRouterNetworkError(error: any): boolean {
  const text = String(error?.message || '').toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  return (
    text.includes('terminated') ||
    text.includes('request timed out') ||
    text.includes('timed out') ||
    text.includes('econnreset') ||
    text.includes('socket hang up') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT'
  );
}

async function createOpenRouterChatCompletionWithRetry(input: {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  maxTokens: number;
}) {
  if (!openRouterClient) throw new Error('OpenRouter API не настроен.');
  let lastError: any = null;
  const modelsInOrder = [
    input.model,
    ...(input.model !== AI_FALLBACK_MODEL && ALLOWED_AI_MODELS.has(AI_FALLBACK_MODEL) ? [AI_FALLBACK_MODEL] : [])
  ];

  for (const modelForAttempt of modelsInOrder) {
    for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const maxTokensForAttempt = modelForAttempt === AI_FALLBACK_MODEL
          ? Math.min(input.maxTokens, 1200)
          : input.maxTokens;
        return await openRouterClient.chat.completions.create(
          {
            model: modelForAttempt,
            messages: input.messages as any,
            temperature: input.temperature,
            max_tokens: maxTokensForAttempt,
          },
          { timeout: OPENROUTER_REQUEST_TIMEOUT_MS }
        );
      } catch (error: any) {
        lastError = error;
        if (!isRetryableOpenRouterNetworkError(error) || attempt >= OPENROUTER_MAX_ATTEMPTS_PER_MODEL) {
          break;
        }
        console.warn(`[AI] OpenRouter transient network error on ${modelForAttempt}, retry ${attempt}/${OPENROUTER_MAX_ATTEMPTS_PER_MODEL - 1}...`, {
          message: error?.message,
          code: error?.code || error?.cause?.code
        });
        await new Promise((resolve) => setTimeout(resolve, OPENROUTER_NETWORK_RETRY_DELAY_MS * attempt));
      }
    }
  }
  throw lastError;
}

function asUserFacingAiError(error: any): string {
  const msg = String(error?.message || '').trim();
  const low = msg.toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  if (low.includes('terminated') || low.includes('econnreset') || code === 'ECONNRESET') {
    return 'Не удалось получить ответ от AI. Попробуйте позже или обратитесь в техподдержку.';
  }
  return msg || 'Не удалось получить ответ от AI. Попробуйте позже или обратитесь в техподдержку.';
}

function resolveAiModel(modelRaw: unknown): string {
  const requested = typeof modelRaw === 'string' ? modelRaw.trim() : '';
  const candidate = requested || DEFAULT_AI_MODEL;
  if (!ALLOWED_AI_MODELS.has(candidate)) {
    return DEFAULT_AI_MODEL;
  }
  return candidate;
}

async function getPlatformAiModel(): Promise<string> {
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "PlatformSetting" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL)'
    );
    const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
      'SELECT "value" FROM "PlatformSetting" WHERE "key" = ? LIMIT 1',
      'ai_model_default'
    );
    const raw = rows?.[0]?.value;
    return resolveAiModel(raw || DEFAULT_AI_MODEL);
  } catch {
    return resolveAiModel(DEFAULT_AI_MODEL);
  }
}

function buildPsychologistDreamWhere(input: {
  requestedClientId?: string;
  clientIds: string[];
  userId: string;
  dreamsContextRange: DreamsContextRange;
}) {
  const { requestedClientId, clientIds, userId, dreamsContextRange } = input;
  const targetClientIds =
    requestedClientId && clientIds.includes(requestedClientId) ? [requestedClientId] : clientIds;
  const minDate = minDateForDreamRange(dreamsContextRange);
  const dateWhere = minDate ? { createdAt: { gte: minDate } } : {};

  if (requestedClientId && clientIds.includes(requestedClientId)) {
    return {
      clientId: requestedClientId,
      ...dateWhere
    };
  }

  const whereConditions: any[] = [];
  if (targetClientIds.length > 0) {
    whereConditions.push({ clientId: { in: targetClientIds } });
  }
  whereConditions.push({ userId });
  return {
    AND: [
      { OR: whereConditions.length > 0 ? whereConditions : [{ userId }] },
      ...(minDate ? [{ createdAt: { gte: minDate } }] : [])
    ]
  };
}

router.post('/ai/psychologist/dream-scope-preview', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const requestedClientId = String(req.body?.clientId || '').trim() || undefined;
    const includeDreamsInContext =
      req.body?.includeDreamsInContext === undefined || req.body?.includeDreamsInContext === null
        ? true
        : Boolean(req.body?.includeDreamsInContext);
    const clientModeEnabled = parsePsychologistClientModeEnabled(req.body);

    if (!includeDreamsInContext) {
      return res.json({
        includeDreamsInContext: false,
        stats: {
          '30d': { count: 0, cappedCount: 0, estimatedPromptTokens: 0, estimatedInputCostUsd: 0 },
          '90d': { count: 0, cappedCount: 0, estimatedPromptTokens: 0, estimatedInputCostUsd: 0 },
          '365d': { count: 0, cappedCount: 0, estimatedPromptTokens: 0, estimatedInputCostUsd: 0 },
          all: { count: 0, cappedCount: 0, estimatedPromptTokens: 0, estimatedInputCostUsd: 0 }
        },
        suggestedRange: '30d' as DreamsContextRange
      });
    }

    const clients = clientModeEnabled
      ? await prisma.client.findMany({
          where: { psychologistId: req.user!.id },
          select: { id: true, name: true }
        })
      : [];
    const clientIds = clients.map(c => c.id);
    const ranges: DreamsContextRange[] = ['30d', '90d', '365d', 'all'];

    const model = await getPlatformAiModel();
    const entries = await Promise.all(
      ranges.map(async (range) => {
        const where = buildPsychologistDreamWhere({
          requestedClientId,
          clientIds,
          userId: req.user!.id,
          dreamsContextRange: range
        });
        const count = await prisma.dream.count({ where });
        const capped = Math.min(count, MAX_DREAM_ROWS_BY_RANGE[range]);
        const sampleDreams = capped > 0
          ? await prisma.dream.findMany({
              where,
              orderBy: { createdAt: 'asc' },
              take: capped,
              select: { title: true, content: true, symbols: true }
            })
          : [];
        const chars = sampleDreams.reduce((acc, d) => {
          const title = String(d.title || '');
          const contentRaw = String(d.content || '');
          const content = contentRaw.length > 1200 ? contentRaw.slice(0, 1200) : contentRaw;
          const symbols = formatDreamSymbolsForPrompt(d.symbols);
          return acc + title.length + content.length + symbols.length + 160;
        }, 0);
        const estimatedPromptTokens = Math.max(0, Math.ceil(chars / 4));
        const estimatedInputCostUsd = Number(((estimatedPromptTokens / 1_000_000) * DEFAULT_ESTIMATED_INPUT_COST_PER_1M).toFixed(4));
        return [
          range,
          {
            count,
            cappedCount: capped,
            estimatedPromptTokens,
            estimatedInputCostUsd
          }
        ] as const;
      })
    );

    const stats = Object.fromEntries(entries) as Record<
      DreamsContextRange,
      { count: number; cappedCount: number; estimatedPromptTokens: number; estimatedInputCostUsd: number }
    >;
    const allCount = stats.all?.count || 0;
    const suggestedRange: DreamsContextRange =
      allCount <= 100 ? 'all' : allCount <= 300 ? '365d' : allCount <= 700 ? '90d' : '30d';

    const selectedClient =
      requestedClientId && clients.find((c) => c.id === requestedClientId)
        ? clients.find((c) => c.id === requestedClientId)!.name
        : null;

    res.json({
      includeDreamsInContext: true,
      model,
      pricingNote: `Оценка стоимости приблизительная и учитывает только входные токены.`,
      stats,
      suggestedRange,
      selectedClient
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Не удалось получить объем анализа снов' });
  }
});

router.post('/ai/dream/analyze', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { content, symbols, dreamId } = req.body ?? {};
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Автоматическое извлечение символов из текста, если не предоставлены
    let extractedSymbols: string[] = symbols || [];
    
    if (!extractedSymbols || extractedSymbols.length === 0) {
      // Простое извлечение символов (ключевые слова)
      // В будущем можно использовать NER модель
      const commonSymbols = ['вода', 'лес', 'змея', 'дракон', 'огонь', 'земля', 'воздух', 'дом', 'дорога', 'мост', 'дверь', 'окно', 'лестница', 'гора', 'море', 'река', 'дерево', 'цветок', 'животное', 'птица', 'рыба', 'кошка', 'собака', 'лошадь', 'волк', 'медведь', 'орел', 'змея', 'рыба'];
      const contentLower = content.toLowerCase();
      extractedSymbols = commonSymbols.filter(symbol => contentLower.includes(symbol));
      
      // Также ищем слова, которые могут быть символами (существительные)
      const words = content.toLowerCase().match(/\b[а-яё]{4,}\b/g) || [];
      extractedSymbols = [...new Set([...extractedSymbols, ...words.slice(0, 10)])];
    }

    // Подсчет частоты символов
    const freq: Record<string, number> = {};
    for (const s of extractedSymbols) {
      freq[s] = (freq[s] ?? 0) + 1;
    }

    // Базовый анализ эмоций (можно улучшить с помощью AI)
    const emotions: string[] = [];
    const contentLower = content.toLowerCase();
    if (contentLower.includes('страх') || contentLower.includes('бояться') || contentLower.includes('испуг')) emotions.push('страх');
    if (contentLower.includes('радость') || contentLower.includes('счастлив') || contentLower.includes('веселье')) emotions.push('радость');
    if (contentLower.includes('грусть') || contentLower.includes('печаль') || contentLower.includes('тоска')) emotions.push('грусть');
    if (contentLower.includes('злость') || contentLower.includes('гнев') || contentLower.includes('ярость')) emotions.push('злость');
    if (emotions.length === 0) emotions.push('нейтрально');

    // Базовый анализ архетипов (можно улучшить)
    const archetypes: string[] = [];
    if (contentLower.includes('тень') || contentLower.includes('темн') || contentLower.includes('черн')) archetypes.push('тень');
    if (contentLower.includes('мать') || contentLower.includes('женщин') || contentLower.includes('материнск')) archetypes.push('мать');
    if (contentLower.includes('отец') || contentLower.includes('мужчин') || contentLower.includes('отцовск')) archetypes.push('отец');
    if (contentLower.includes('ребенок') || contentLower.includes('детск')) archetypes.push('ребенок');
    if (contentLower.includes('мудр') || contentLower.includes('старец') || contentLower.includes('учитель')) archetypes.push('мудрец');
    if (archetypes.length === 0) archetypes.push('неопределено');

    // Рекомендации на основе символов
    const recommendations: string[] = [];
    if (extractedSymbols.some(s => ['вода', 'море', 'река'].includes(s))) {
      recommendations.push('работа с эмоциональной сферой');
    }
    if (extractedSymbols.some(s => ['лес', 'дерево', 'природа'].includes(s))) {
      recommendations.push('связь с бессознательным');
    }
    if (extractedSymbols.some(s => ['змея', 'дракон'].includes(s))) {
      recommendations.push('работа с трансформацией');
    }
    if (emotions.includes('страх')) {
      recommendations.push('исследование источников страха');
    }
    if (recommendations.length === 0) {
      recommendations.push('практика активного воображения');
      recommendations.push('ведение дневника эмоций');
    }

    // Если есть dreamId, сохраняем символы: эвристики анализа + извлечение из текста сна
    if (dreamId) {
      try {
        const existing = await (prisma as any).dream.findUnique({
          where: { id: dreamId },
          select: { title: true }
        });
        const title = existing?.title != null ? String(existing.title) : '';
        const merged = mergeDreamKeywords(title, String(content), extractedSymbols);
        await (prisma as any).dream.update({
          where: { id: dreamId },
          data: { symbols: merged }
        });
      } catch (e) {
        // Игнорируем ошибки обновления
      }
    }

    // Предложение амплификаций на основе символов
    const suggestedAmplifications: any[] = [];
    if (extractedSymbols.length > 0) {
      const topSymbols = Object.entries(freq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([symbol]) => symbol);

      for (const symbol of topSymbols) {
        const amps = await (prisma as any).amplification.findMany({
          where: {
            OR: [
              { symbol: { contains: symbol, mode: 'insensitive' } },
              { title: { contains: symbol, mode: 'insensitive' } }
            ],
            isPublic: true
          },
          take: 1
        });
        if (amps.length > 0) {
          suggestedAmplifications.push(amps[0]);
        }
      }
    }

    res.json({
      frequency: freq,
      emotions,
      archetypes,
      recommendations,
      extractedSymbols,
      suggestedAmplifications: suggestedAmplifications.map(a => ({
        id: a.id,
        symbol: a.symbol,
        title: a.title
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to analyze dream' });
  }
});

router.get('/ai/dream/similar', requireAuth, (_req, res) => {
  res.json({ similar: [] });
});

router.post('/ai/hypotheses', requireAuth, (_req, res) => {
  res.json({ hypotheses: ['символ воды ↔ эмоц. регуляция', 'повтор тени ↔ неосознаваемые конфликты'] });
});

router.get('/ai/tokens/quota', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const quota = await getAiQuotaStatus(req.user!.id);
    res.json({ quota });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load AI quota' });
  }
});

// Чат ассистента психолога
router.post('/ai/psychologist/chat', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!openRouterClient) {
      return res.status(500).json({ error: 'OpenRouter API не настроен. Установите OPENROUTER_API_KEY в переменных окружения.' });
    }

    const {
      message,
      conversationHistory = [],
      modality: modalityRaw,
      temperature: temperatureRaw,
      responseStyle: responseStyleRaw,
      personalization: personalizationRaw,
      psychologistProfile: psychologistProfileRaw,
      dreamsContextRange: dreamsContextRangeRaw,
      includeDreamsInContext: includeDreamsRaw,
      analysisMemory: analysisMemoryRaw,
    } = req.body ?? {};
    const clientModeEnabled = parsePsychologistClientModeEnabled(req.body);
    const model = await getPlatformAiModel();

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }
    const quotaBefore = await assertAiQuotaAvailable(req.user!.id);

    const modality = normalizePsychologistModality(modalityRaw);
    const modalityPolicy = getModalityPolicy(modality);
    const temperature = clampAiTemperature(temperatureRaw);
    const responseStyle = (['concise', 'balanced', 'detailed'].includes(String(responseStyleRaw))
      ? responseStyleRaw
      : 'balanced') as ResponseStyle;
    const baseMaxTokens = Math.min(MAX_AI_OUTPUT_TOKENS, inferMaxTokensFromResponseStyle(responseStyle));
    let maxTokens = baseMaxTokens;
    const safeConversationHistory = trimConversationHistory(conversationHistory);
    const personalization =
      typeof personalizationRaw === 'string' && personalizationRaw.trim()
        ? personalizationRaw
        : typeof psychologistProfileRaw === 'string'
          ? psychologistProfileRaw
          : '';
    const dreamsContextRange = parseDreamsContextRange(dreamsContextRangeRaw);
    const includeDreamsInContext =
      includeDreamsRaw === undefined || includeDreamsRaw === null ? true : Boolean(includeDreamsRaw);
    const previousAnalysisMemory =
      typeof analysisMemoryRaw === 'string' && analysisMemoryRaw.trim()
        ? analysisMemoryRaw.trim().slice(0, 5000)
        : '';

    // Если режим работы с клиентами выключен, работаем в обобщенном режиме (без контекста клиентов, но с вызовом OpenRouter)
    if (!clientModeEnabled) {
      let systemPrompt = appendResponseStyle(buildGeneralModalityPrompt(modality), responseStyle);
      if (!includeDreamsInContext) {
        systemPrompt += `\n\nНастройка психолога: не акцентировать сны и сновидения; тексты снов в этот запрос не включены.`;
      }
      systemPrompt = appendPersonalization(systemPrompt, personalization);
      systemPrompt = appendArchetypeLanguageGuard(modality, systemPrompt);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...safeConversationHistory.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      let assistantMessage = 'Извините, не удалось получить ответ.';

      try {
        console.log('Sending request to OpenRouter API (psychologist general mode, no client data)...', {
          model,
          messagesCount: messages.length,
          hasOpenRouterKey: !!apiKey
        });
        const chatCompletion = await createOpenRouterChatCompletionWithRetry({
          model,
          messages,
          temperature,
          maxTokens,
        });

        assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
        const quota = await consumeAiTokens(req.user!.id, {
          usageTotal: (chatCompletion as any)?.usage?.total_tokens,
          promptText: messages.map((m: any) => m.content).join('\n'),
          completionText: assistantMessage
        });
        return res.json({
          message: assistantMessage,
          quota,
          conversationHistory: [
            ...safeConversationHistory,
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage }
          ]
        });
      } catch (error: any) {
        console.error('OpenRouter API error:', error);
        let errorMessage = 'Ошибка при обращении к ИИ';
        if (error.message?.includes('timeout')) {
          errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
        } else if (error.status === 503) {
          errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
        } else if (error.status === 401) {
          errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
        } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
          errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
        } else if (error.message) {
          errorMessage = asUserFacingAiError(error);
        }
        throw new Error(errorMessage);
      }
    }

    /** Сны в запрос: и модальность разрешает, и тумблер психолога включён */
    const passDreamData = includeDreamsInContext && modalityPolicy.allowDreams;
    const isDreamAnalysisRequest = messageLooksLikeDreamAnalysis(message) && passDreamData;
    maxTokens = isDreamAnalysisRequest
      ? Math.max(baseMaxTokens, DREAM_ANALYSIS_MAX_OUTPUT_TOKENS)
      : baseMaxTokens;

    // Получаем клиентов психолога с полной информацией (только если режим работы с клиентами включен)
    const clients = await prisma.client.findMany({
      where: { psychologistId: req.user!.id },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Получаем все заметки о клиентах (рабочая область)
    const clientIds = clients.map(c => c.id);
    const allNotes = clientIds.length > 0 
      ? await prisma.clientNote.findMany({
          where: { clientId: { in: clientIds } },
          orderBy: { createdAt: 'desc' },
          take: 50, // Последние 50 заметок
          select: {
            id: true,
            clientId: true,
            content: true,
            createdAt: true,
            authorId: true
          }
        })
      : [];

    // Получаем все сессии терапии
    const allSessions = clientIds.length > 0
      ? await prisma.therapySession.findMany({
          where: { clientId: { in: clientIds } },
          orderBy: { date: 'desc' },
          take: 30, // Последние 30 сессий
          select: {
            id: true,
            clientId: true,
            date: true,
            summary: true,
            videoUrl: true,
            createdAt: true
          }
        })
      : [];

    // Получаем все документы рабочей области (Ведение клиента, запрос, анамнез, ценности/кредо и т.д.)
    const allDocuments: Array<{
      id: string;
      clientId: string;
      tabName: string;
      content: string;
      updatedAt: Date;
    }> = clientIds.length > 0
      ? await (prisma as any).clientDocument.findMany({
          where: { 
            clientId: { in: clientIds },
            psychologistId: req.user!.id
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            clientId: true,
            tabName: true,
            content: true,
            updatedAt: true
          }
        })
      : [];

    // Сны для контекста: период задаётся dreamsContextRange (по умолчанию 30 дней).
    // Если выбран конкретный клиент — только его сны в периоде (полный текст каждого сна).
    const requestedClientId = req.body?.clientId as string | undefined;
    const dreamWhere = buildPsychologistDreamWhere({
      requestedClientId,
      clientIds,
      userId: req.user!.id,
      dreamsContextRange
    });

    const maxDreamRows = MAX_DREAM_ROWS_BY_RANGE[dreamsContextRange];
    const allDreams = passDreamData
      ? await prisma.dream.findMany({
          where: dreamWhere,
          orderBy: { createdAt: 'asc' },
          take: maxDreamRows,
          include: {
            client: {
              select: { id: true, name: true, email: true }
            }
          }
        })
      : [];

    const rangeLabel = dreamRangeLabelRu(dreamsContextRange);
    let dreamsContext = '';
    if (allDreams.length > 0) {
      let truncatedNote = '';
      if (allDreams.length === maxDreamRows) {
        const totalMatching = await prisma.dream.count({ where: dreamWhere });
        if (totalMatching > maxDreamRows) {
          truncatedNote = `\nВнимание: за период в базе ${totalMatching} снов; в контекст включены первые ${maxDreamRows} (лимит). Сузьте период в настройках или уточните вопрос.\n`;
        }
      }

      dreamsContext = `\n\nСны для анализа (период: ${rangeLabel}; в контексте: ${allDreams.length} записей`;
      if (requestedClientId && clientIds.includes(requestedClientId)) {
        const c = clients.find(cl => cl.id === requestedClientId);
        dreamsContext += `; выбранный клиент: ${c?.name || requestedClientId}`;
      }
      dreamsContext += `). Ниже полный текст каждого сна в хронологическом порядке.${truncatedNote}`;

      allDreams.forEach((dream, idx) => {
        const clientName = dream.client?.name || 'Неизвестный клиент';
        const sym = formatDreamSymbolsForPrompt(dream.symbols);
        dreamsContext += `\n${idx + 1}. "${dream.title || 'Без названия'}" (клиент: ${clientName}, ${new Date(dream.createdAt).toLocaleString('ru-RU')})\n`;
        const contentForPrompt = String(dream.content || '');
        const limitedContent = contentForPrompt.length > 1200
          ? `${contentForPrompt.slice(0, 1200)}...`
          : contentForPrompt;
        dreamsContext += `   Содержание: ${limitedContent}\n`;
        if (sym) dreamsContext += `   Символы: ${sym}\n`;
      });
      dreamsContext += '\n';
    } else if (passDreamData) {
      dreamsContext = `\n\nЗа период «${rangeLabel}» записей снов для текущего контекста не найдено.\n`;
    } else if (!includeDreamsInContext) {
      dreamsContext = '\n\nНовые тексты снов в этот запрос не добавлены (настройка «работа со снами» выключена). Можно опираться на уже имеющуюся историю диалога.\n';
    } else {
      dreamsContext = '\n\nСны исключены из контекста для выбранной модальности.\n';
    }

    // Формируем контекст о клиентах
    let clientsContext = '';
    if (clients.length > 0) {
      clientsContext = `\n\nБаза данных клиентов:\n`;
      clientsContext += `Всего клиентов: ${clients.length}\n\n`;
      
      clients.forEach((client, idx) => {
        clientsContext += `Клиент ${idx + 1}: ${client.name}\n`;
        clientsContext += `  ID: ${client.id}\n`;
        if (client.email) clientsContext += `  Email: ${client.email}\n`;
        if (client.phone) clientsContext += `  Телефон: ${client.phone}\n`;
        clientsContext += `  Дата добавления: ${new Date(client.createdAt).toLocaleString('ru-RU')}\n`;
        
        // Добавляем заметки о клиенте
        const clientNotes = allNotes.filter(n => n.clientId === client.id);
        if (clientNotes.length > 0) {
          clientsContext += `  Заметок о клиенте: ${clientNotes.length}\n`;
          clientNotes.slice(0, 5).forEach((note, noteIdx) => {
            clientsContext += `    Заметка ${noteIdx + 1} (${new Date(note.createdAt).toLocaleString('ru-RU')}): ${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}\n`;
          });
        }
        
        // Добавляем сессии клиента
        const clientSessions = allSessions.filter(s => s.clientId === client.id);
        if (clientSessions.length > 0) {
          clientsContext += `  Сессий терапии: ${clientSessions.length}\n`;
          clientSessions.slice(0, 3).forEach((session, sessIdx) => {
            clientsContext += `    Сессия ${sessIdx + 1} (${new Date(session.date).toLocaleString('ru-RU')}):\n`;
            if (session.summary) {
              clientsContext += `      Резюме: ${session.summary.substring(0, 100)}${session.summary.length > 100 ? '...' : ''}\n`;
            }
          });
        }
        clientsContext += '\n';
      });
    } else {
      clientsContext = '\n\nВ базе данных пока нет клиентов.';
    }

    // Формируем контекст рабочей области (последние заметки и сессии)
    let workAreaContext = '';
    if (allNotes.length > 0 || allSessions.length > 0) {
      workAreaContext = `\n\nРабочая область (последние записи):\n`;
      
      if (allNotes.length > 0) {
        workAreaContext += `Последние заметки о клиентах (${allNotes.length}):\n`;
        allNotes.slice(0, 10).forEach((note, idx) => {
          const client = clients.find(c => c.id === note.clientId);
          workAreaContext += `${idx + 1}. Клиент: ${client?.name || 'Неизвестен'} (${new Date(note.createdAt).toLocaleString('ru-RU')})\n`;
          workAreaContext += `   ${note.content.substring(0, 200)}${note.content.length > 200 ? '...' : ''}\n\n`;
        });
      }
      
      if (allSessions.length > 0) {
        workAreaContext += `Последние сессии терапии (${allSessions.length}):\n`;
        allSessions.slice(0, 10).forEach((session, idx) => {
          const client = clients.find(c => c.id === session.clientId);
          workAreaContext += `${idx + 1}. Клиент: ${client?.name || 'Неизвестен'}, Дата: ${new Date(session.date).toLocaleString('ru-RU')}\n`;
          if (session.summary) {
            workAreaContext += `   Резюме: ${session.summary.substring(0, 200)}${session.summary.length > 200 ? '...' : ''}\n`;
          }
          workAreaContext += '\n';
        });
      }
    }

    // Получаем список всех вкладок для каждого клиента (включая кастомные)
    const allClientTabs: Record<string, string[]> = {};
    for (const client of clients) {
      try {
        const clientTabs = await (prisma as any).clientTabs.findUnique({
          where: { clientId: client.id }
        });
        if (clientTabs && Array.isArray(clientTabs.tabs)) {
          allClientTabs[client.id] = clientTabs.tabs;
        }
      } catch (error) {
        // Игнорируем ошибки, используем только документы
      }
    }

    // Формируем контекст документов рабочей области
    let documentsContext = '';
    if (allDocuments.length > 0 || Object.keys(allClientTabs).length > 0) {
      documentsContext = `\n\nДокументы рабочей области (записи о пациентах):\n`;
      documentsContext += `Примечание: Вкладки могут быть стандартными (Ведение клиента, запрос, анамнез, ценности/кредо, раздражители, сны, записи, Дневник клиента, Синхронии) или кастомными, созданными психологом.\n`;
      
      // Группируем документы по клиентам
      clients.forEach(client => {
        const clientDocs = allDocuments.filter(d => d.clientId === client.id);
        const clientTabsList = allClientTabs[client.id] || [];
        
        if (clientDocs.length > 0 || clientTabsList.length > 0) {
          documentsContext += `\nКлиент: ${client.name}\n`;
          
          // Если есть список вкладок, используем его порядок, иначе используем порядок документов
          const tabsToShow = clientTabsList.length > 0 ? clientTabsList : clientDocs.map(d => d.tabName);
          
          tabsToShow.forEach((tabName) => {
            const normalizedTab = String(tabName || '').trim().toLowerCase();
            const isDreamTab = normalizedTab === 'сны';
            const isSynchTab = normalizedTab === 'синхронии';
            if (isDreamTab && !passDreamData) return;
            if (isSynchTab && !modalityPolicy.allowSynchronicities) return;

            const doc = clientDocs.find(d => d.tabName === tabName);
            
            if (doc) {
              // Извлекаем текстовое содержимое из HTML (убираем теги)
              const textContent = doc.content
                .replace(/<[^>]*>/g, ' ') // Убираем HTML теги
                .replace(/\s+/g, ' ') // Убираем лишние пробелы
                .trim();
              
              documentsContext += `  ${doc.tabName} (обновлено: ${new Date(doc.updatedAt).toLocaleString('ru-RU')}):\n`;
              if (textContent) {
                documentsContext += `    ${textContent.substring(0, 500)}${textContent.length > 500 ? '...' : ''}\n`;
              } else {
                documentsContext += `    [Документ пуст]\n`;
              }
              documentsContext += '\n';
            } else if (clientTabsList.includes(tabName)) {
              // Вкладка существует, но документ еще не создан
              documentsContext += `  ${tabName}: [Вкладка создана, но документ еще не заполнен]\n\n`;
            }
          });
        }
      });
    } else {
      documentsContext = '\n\nВ рабочей области пока нет сохраненных документов о пациентах.';
    }

    // Формируем system prompt (модальность влияет на акценты; сны — по passDreamData)
    let systemPrompt = appendResponseStyle(
      buildClientModalityPrompt(modality, { includeDreamsInContext: passDreamData }),
      responseStyle
    );
    systemPrompt = appendPersonalization(systemPrompt, personalization);
    systemPrompt = appendArchetypeLanguageGuard(modality, systemPrompt);

    const dreamCountForAnalysis = allDreams.length;
    const userPrompt = `${dreamsContext}${clientsContext}${workAreaContext}${documentsContext}
${previousAnalysisMemory ? `\n\nСохраненный анализ по этому чату (используй как рабочую память):\n${previousAnalysisMemory}\n` : ''}
${isDreamAnalysisRequest ? `\n\nВажно: в контексте передано ${dreamCountForAnalysis} снов(а). Дай структурированный разбор ПО КАЖДОМУ сну без пропусков в формате "Сон 1 ... Сон ${dreamCountForAnalysis}". Нельзя объединять сны. После разборов добавь общий итог по паттернам.\n` : ''}

Вопрос психолога: ${message}`;

    // Формируем историю сообщений для DeepSeek-R1
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...safeConversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    console.log('Sending request to OpenRouter API...', { 
      model,
      messagesCount: messages.length,
      hasOpenRouterKey: !!apiKey,
      modality
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';
    let quota = quotaBefore;
    const analysisMemoryUpdated = messageLooksLikeDreamAnalysis(message) && passDreamData;

    try {
      console.log('Using OpenRouter API...');
      const chatCompletion = await createOpenRouterChatCompletionWithRetry({
        model,
        messages,
        temperature,
        maxTokens,
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      quota = await consumeAiTokens(req.user!.id, {
        usageTotal: (chatCompletion as any)?.usage?.total_tokens,
        promptText: messages.map((m: any) => m.content).join('\n'),
        completionText: assistantMessage
      });
      
      // Убираем возможные "think" блоки, если модель их генерирует
      // DeepSeek-V3 может генерировать reasoning, но обычно это не проблема
      // Если нужно, можно добавить фильтрацию здесь
      
      console.log('OpenRouter API response received successfully');
    } catch (error: any) {
      console.error('OpenRouter API error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
      } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
        errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
      } else if (error.message) {
        errorMessage = asUserFacingAiError(error);
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      quota,
      analysisMemory: analysisMemoryUpdated ? assistantMessage : previousAnalysisMemory,
      analysisMemoryUpdated,
      conversationHistory: [
        ...safeConversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data || error.response,
      stack: error.stack
    });
    
    // Более детальная обработка ошибок
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
    } else if (error.message) {
      errorMessage = asUserFacingAiError(error);
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Чат ассистента исследователя
router.post('/ai/researcher/chat', requireAuth, requireRole(['researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!openRouterClient) {
      return res.status(500).json({ error: 'OpenRouter API не настроен. Установите OPENROUTER_API_KEY в переменных окружения.' });
    }

    const { message, conversationHistory = [] } = req.body ?? {};
    const safeConversationHistory = trimConversationHistory(conversationHistory);

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }
    const quotaBefore = await assertAiQuotaAvailable(req.user!.id);

    // Получаем все сны для исследователя
    const allDreams = await prisma.dream.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 100, // Последние 100 снов
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Формируем контекст снов
    let dreamsContext = '';
    if (allDreams.length > 0) {
      dreamsContext = `\n\nБаза данных снов (последние ${allDreams.length}):\n`;
      allDreams.slice(0, 20).forEach((dream, idx) => {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols.join(', ') : (typeof dream.symbols === 'object' && dream.symbols !== null ? Object.keys(dream.symbols).join(', ') : '');
        dreamsContext += `${idx + 1}. "${dream.title || 'Без названия'}" (${dream.client?.name || 'Неизвестный клиент'}) - ${dream.content?.substring(0, 200)}... Символы: ${symbols || 'нет'}\n`;
      });
    } else {
      dreamsContext = '\n\nВ базе данных пока нет снов.';
    }

    // Формируем system prompt
    const systemPrompt = `Ты — ассистент исследователя, специализирующийся на аналитической психологии, юнгианском анализе и исследовании сновидений. Твоя задача — помогать исследователю с анализом данных, выявлением паттернов, интерпретацией снов, исследованием архетипов и символики.

Ты имеешь доступ к:
1. Базе данных снов (все сны в системе)
2. Данным исследований
3. Публикациям и материалам

Можешь отвечать на вопросы о снах, анализировать паттерны, предлагать интерпретации, помогать с исследованиями и анализом данных.

Отвечай на русском языке, профессионально, но доступно. Используй знания юнгианской психологии, архетипов, символики и работы со сновидениями.`;

    const userPrompt = `${dreamsContext}

Вопрос исследователя: ${message}`;

    // Формируем историю сообщений для DeepSeek-R1
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...safeConversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    const model = await getPlatformAiModel();
    console.log('Sending request to OpenRouter API for researcher...', { 
      model,
      messagesCount: messages.length,
      hasOpenRouterKey: !!apiKey
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';
    let quota = quotaBefore;

    try {
      console.log('Using OpenRouter API...');
      const chatCompletion = await createOpenRouterChatCompletionWithRetry({
        model,
        messages,
        temperature: 0.7,
        maxTokens: 900,
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      quota = await consumeAiTokens(req.user!.id, {
        usageTotal: (chatCompletion as any)?.usage?.total_tokens,
        promptText: messages.map((m: any) => m.content).join('\n'),
        completionText: assistantMessage
      });
      
      // Убираем возможные "think" блоки, если модель их генерирует
      // DeepSeek-V3 может генерировать reasoning, но обычно это не проблема
      // Если нужно, можно добавить фильтрацию здесь
      
      console.log('OpenRouter API response received successfully');
    } catch (error: any) {
      console.error('OpenRouter API error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
      } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
        errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
      } else if (error.message) {
        errorMessage = asUserFacingAiError(error);
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      quota,
      conversationHistory: [
        ...safeConversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
    } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
      errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
    } else if (error.message) {
      errorMessage = asUserFacingAiError(error);
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Чат ассистента клиента (с ограничениями - только мягкая рефлексия)
router.post('/ai/client/chat', requireAuth, requireRole(['client', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    if (!openRouterClient) {
      return res.status(500).json({ error: 'OpenRouter API не настроен. Установите OPENROUTER_API_KEY в переменных окружения.' });
    }

    const { message, conversationHistory = [] } = req.body ?? {};
    const safeConversationHistory = trimConversationHistory(conversationHistory);

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }
    const quotaBefore = await assertAiQuotaAvailable(req.user!.id);

    // Находим клиента по email
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, name: true }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Получаем сны клиента
    const clientDreams = await prisma.dream.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 20, // Последние 20 снов
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true
      }
    });

    // Получаем записи дневника клиента
    const journalEntries = await prisma.journalEntry.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 10, // Последние 10 записей
      select: {
        id: true,
        content: true,
        createdAt: true
      }
    });

    // Формируем контекст о снах
    let dreamsContext = '';
    if (clientDreams.length > 0) {
      dreamsContext = `\n\nВаши последние сны (${clientDreams.length}):\n`;
      clientDreams.slice(0, 5).forEach((dream, idx) => {
        dreamsContext += `${idx + 1}. "${dream.title || 'Без названия'}" (${new Date(dream.createdAt).toLocaleDateString('ru-RU')})\n`;
        if (dream.content) {
          dreamsContext += `   ${dream.content.substring(0, 200)}${dream.content.length > 200 ? '...' : ''}\n`;
        }
        if (Array.isArray(dream.symbols) && dream.symbols.length > 0) {
          dreamsContext += `   Символы: ${dream.symbols.join(', ')}\n`;
        }
        dreamsContext += '\n';
      });
    } else {
      dreamsContext = '\n\nУ вас пока нет записанных снов.';
    }

    // Формируем контекст о записях дневника
    let journalContext = '';
    if (journalEntries.length > 0) {
      journalContext = `\n\nВаши последние записи в дневнике (${journalEntries.length}):\n`;
      journalEntries.slice(0, 3).forEach((entry, idx) => {
        journalContext += `${idx + 1}. ${new Date(entry.createdAt).toLocaleDateString('ru-RU')}:\n`;
        journalContext += `   ${entry.content.substring(0, 150)}${entry.content.length > 150 ? '...' : ''}\n\n`;
      });
    } else {
      journalContext = '\n\nУ вас пока нет записей в дневнике.';
    }

    // Формируем system prompt с ограничениями для клиента
    const systemPrompt = `Ты — помощник для клиента, работающего с психологом. Твоя задача — поддерживать мягкую рефлексию, помогать с формулировкой вопросов и запросов, но НЕ давать интерпретации, диагнозы или глубокий анализ.

ВАЖНЫЕ ОГРАНИЧЕНИЯ:
- НЕ интерпретируй сны и не давай "значения" символам
- НЕ стави диагнозы и не давай медицинские/психологические заключения
- НЕ анализируй глубоко психологические паттерны
- Можешь помогать с формулировкой вопросов к психологу
- Можешь поддерживать рефлексию через открытые вопросы
- Можешь предлагать записать мысли в дневник
- Можешь помогать структурировать запросы к психологу

Ты имеешь доступ к:
1. Снам клиента (только для контекста, не для интерпретации)
2. Записям дневника клиента (только для контекста)

Отвечай на русском языке, дружелюбно, поддерживающе, но помни об ограничениях. Направляй клиента к его психологу для глубокой работы.`;

    const userPrompt = `${dreamsContext}${journalContext}

Вопрос клиента: ${message}`;

    // Формируем историю сообщений
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...safeConversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      })),
      { role: 'user', content: userPrompt }
    ];

    const model = await getPlatformAiModel();
    console.log('Sending request to OpenRouter API for client...', { 
      model,
      messagesCount: messages.length,
      hasOpenRouterKey: !!apiKey,
      clientId: client.id
    });

    let assistantMessage = 'Извините, не удалось получить ответ.';
    let quota = quotaBefore;

    try {
      console.log('Using OpenRouter API for client...');
      const chatCompletion = await createOpenRouterChatCompletionWithRetry({
        model,
        messages,
        temperature: 0.7,
        maxTokens: 900,
      });

      assistantMessage = chatCompletion.choices[0]?.message?.content || assistantMessage;
      quota = await consumeAiTokens(req.user!.id, {
        usageTotal: (chatCompletion as any)?.usage?.total_tokens,
        promptText: messages.map((m: any) => m.content).join('\n'),
        completionText: assistantMessage
      });
      
      console.log('OpenRouter API response received successfully for client');
    } catch (error: any) {
      console.error('OpenRouter API error for client:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        response: error.response?.data || error.response
      });
      
      let errorMessage = 'Ошибка при обращении к ИИ';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
      } else if (error.status === 503) {
        errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
      } else if (error.status === 401) {
        errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
      } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
        errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
      } else if (error.message) {
        errorMessage = asUserFacingAiError(error);
      }
      
      throw new Error(errorMessage);
    }

    res.json({
      message: assistantMessage,
      quota,
      conversationHistory: [
        ...safeConversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    });
  } catch (error: any) {
    console.error('AI chat error for client:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data || error.response,
      stack: error.stack
    });
    
    // Более детальная обработка ошибок
    let errorMessage = 'Ошибка при обращении к ИИ';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от ИИ. Попробуйте еще раз.';
    } else if (error.status === 503) {
      errorMessage = 'Модель загружается. Подождите несколько секунд и попробуйте снова.';
    } else if (error.status === 401) {
      errorMessage = 'Неверный OpenRouter токен. Проверьте OPENROUTER_API_KEY в .env файле.';
    } else if (error.status === 402 || String(error.message || '').toLowerCase().includes('quota exceeded')) {
      errorMessage = 'Лимит токенов AI исчерпан для текущего периода. Проверьте квоту в настройках.';
    } else if (error.message) {
      errorMessage = asUserFacingAiError(error);
    }
    
    res.status(error.status || 500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Получить все AI чаты психолога
router.get('/ai/psychologist/chats', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const chats = await prisma.aIChat.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const folders = await prisma.aIChatFolder.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { createdAt: 'asc' }
    });

    const shortcuts = await prisma.aIChatShortcut.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      chats: chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        messages: chat.messages,
        folderId: chat.folderId,
        clientId: chat.clientId,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString()
      })),
      folders: folders.map(folder => ({
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt.toISOString()
      })),
      shortcuts: shortcuts.map(shortcut => ({
        id: shortcut.id,
        label: shortcut.label,
        emoji: shortcut.emoji,
        prompt: shortcut.prompt,
        createdAt: shortcut.createdAt.toISOString()
      }))
    });
  } catch (error: any) {
    console.error('Failed to load AI chats:', error);
    res.status(500).json({ error: error.message || 'Failed to load chats' });
  }
});

// Сохранить AI чат
router.post('/ai/psychologist/chats', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, title, messages, folderId, clientId } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    const chatData = {
      psychologistId: req.user!.id,
      title,
      messages: messages as any,
      folderId: folderId || null,
      clientId: clientId || null
    };

    let chat;
    if (id) {
      // Проверяем, существует ли чат
      const existingChat = await prisma.aIChat.findFirst({
        where: { id, psychologistId: req.user!.id }
      });
      
      if (existingChat) {
        // Обновить существующий чат
        chat = await prisma.aIChat.update({
          where: { id },
          data: chatData,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
      } else {
        // Создать новый чат (если ID был передан, но чата нет в БД)
        chat = await prisma.aIChat.create({
          data: { id, ...chatData },
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });
      }
    } else {
      // Создать новый чат
      chat = await prisma.aIChat.create({
        data: chatData,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    }

    res.json({
      id: chat.id,
      title: chat.title,
      messages: chat.messages,
      folderId: chat.folderId,
      clientId: chat.clientId,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save AI chat:', error);
    res.status(500).json({ error: error.message || 'Failed to save chat' });
  }
});

// Удалить AI чат
router.delete('/ai/psychologist/chats/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const chat = await prisma.aIChat.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    await prisma.aIChat.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete AI chat:', error);
    res.status(500).json({ error: error.message || 'Failed to delete chat' });
  }
});

// Создать/обновить папку
router.post('/ai/psychologist/folders', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    let folder;
    if (id) {
      folder = await prisma.aIChatFolder.update({
        where: { id },
        data: { name }
      });
    } else {
      folder = await prisma.aIChatFolder.create({
        data: {
          psychologistId: req.user!.id,
          name
        }
      });
    }

    res.json({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save folder:', error);
    res.status(500).json({ error: error.message || 'Failed to save folder' });
  }
});

// Удалить папку
router.delete('/ai/psychologist/folders/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const folder = await prisma.aIChatFolder.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await prisma.aIChatFolder.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete folder:', error);
    res.status(500).json({ error: error.message || 'Failed to delete folder' });
  }
});

// Создать/обновить шорткат
router.post('/ai/psychologist/shortcuts', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id, label, emoji, prompt } = req.body;

    if (!label || typeof label !== 'string' || !prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Label and prompt are required' });
    }

    let shortcut;
    if (id) {
      const existing = await prisma.aIChatShortcut.findFirst({
        where: { id, psychologistId: req.user!.id }
      });
      if (existing) {
        shortcut = await prisma.aIChatShortcut.update({
          where: { id },
          data: { label, emoji: emoji || '📝', prompt }
        });
      } else {
        shortcut = await prisma.aIChatShortcut.create({
          data: {
            psychologistId: req.user!.id,
            label,
            emoji: emoji || '📝',
            prompt
          }
        });
      }
    } else {
      shortcut = await prisma.aIChatShortcut.create({
        data: {
          psychologistId: req.user!.id,
          label,
          emoji: emoji || '📝',
          prompt
        }
      });
    }

    res.json({
      id: shortcut.id,
      label: shortcut.label,
      emoji: shortcut.emoji,
      prompt: shortcut.prompt,
      createdAt: shortcut.createdAt.toISOString()
    });
  } catch (error: any) {
    console.error('Failed to save shortcut:', error);
    res.status(500).json({ error: error.message || 'Failed to save shortcut' });
  }
});

// Удалить шорткат
router.delete('/ai/psychologist/shortcuts/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;

    const shortcut = await prisma.aIChatShortcut.findFirst({
      where: { id, psychologistId: req.user!.id }
    });

    if (!shortcut) {
      return res.status(404).json({ error: 'Shortcut not found' });
    }

    await prisma.aIChatShortcut.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete shortcut:', error);
    res.status(500).json({ error: error.message || 'Failed to delete shortcut' });
  }
});

export default router;

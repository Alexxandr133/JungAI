import { OpenAI } from 'openai';
import { config } from '../config';
import { MAX_SYMBOLS_PER_DREAM } from '../utils/dreamKeywords';

function makeAiClient(): OpenAI | null {
  const apiKey = config.openRouterApiKey || config.hfToken;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      ...(config.openRouterSiteUrl ? { 'HTTP-Referer': config.openRouterSiteUrl } : {}),
      ...(config.openRouterSiteName ? { 'X-OpenRouter-Title': config.openRouterSiteName } : {}),
    },
  });
}

function getModelName(): string {
  return process.env.DREAM_SYMBOL_MODEL || config.aiModelDefault || 'deepseek/deepseek-chat-v3-0324';
}

export function parseDreamSymbolsResponse(raw: string): string[] {
  const t = (raw || '').trim();
  if (!t) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const symbols = (parsed as { symbols?: unknown }).symbols;
  if (!Array.isArray(symbols)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of symbols) {
    if (typeof item !== 'string') continue;
    const s = item.normalize('NFKC').trim();
    if (!s || s.length > 48) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SYMBOLS_PER_DREAM) break;
  }
  return out;
}

const CURRENT_SYMBOLS_AI_VERSION = 1;

export async function extractDreamSymbolsViaAI(title: string, content: string): Promise<string[]> {
  const ai = makeAiClient();
  if (!ai) {
    throw new Error('OpenRouter API key is not configured');
  }

  const system = [
    'Ты извлекаешь символы из текста сна для юнгианской аналитической психологии.',
    'Верни СТРОГО JSON без markdown и пояснений.',
    `Схема: { "symbols": string[] } — от 3 до ${MAX_SYMBOLS_PER_DREAM} элементов.`,
    '',
    'Правила символов:',
    '- образы, предметы, животные, архетипические фигуры, ключевые локации (обобщённо: «лес», «дом»)',
    '- каждый символ: 1–2 слова на русском, существительное или устойчивое словосочетание',
    '- без имён людей, городов, адресов, телефонов',
    '- без спряжённых глаголов и служебных слов',
    '- допустима капитализация устойчивых образов: «Тень», «ФСБ», «Полиция»',
    '',
    'Не интерпретируй сон — только извлеки символы.',
  ].join('\n');

  const user = [
    `Заголовок: ${(title || 'Без названия').slice(0, 200)}`,
    '',
    'Текст сна:',
    String(content || '').slice(0, 12000),
  ].join('\n');

  const completion = await ai.chat.completions.create(
    {
      model: getModelName(),
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { timeout: 90000 }
  );

  const rawText = completion.choices[0]?.message?.content || '';
  const symbols = parseDreamSymbolsResponse(rawText);
  if (!symbols.length) {
    throw new Error(`AI returned unparseable symbols: ${rawText.slice(0, 120)}`);
  }
  return symbols;
}

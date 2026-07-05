/** Оценка заполнения контекстного окна модели */

export type ContextUsageBreakdown = {
  system: number;
  history: number;
  data: number;
  message: number;
};

export type ContextUsage = {
  estimatedPromptTokens: number;
  contextWindowTokens: number;
  historyMessageCount: number;
  dataContextIncluded: boolean;
  model: string;
  breakdown: ContextUsageBreakdown;
};

const CONTEXT_WINDOW_TOKENS = 100_000;
export const MAX_PROJECT_SPACE_CONTEXT_CHARS = 380_000;

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.max(0, Math.ceil(text.length / 4));
}

export function estimateTokensFromMessages(
  messages: Array<{ role: string; content: unknown }>
): number {
  let total = 0;
  for (const m of messages) {
    const content =
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? JSON.stringify(m.content)
          : String(m.content ?? '');
    total += estimateTokensFromText(content) + 8;
  }
  return total;
}

export function getModelContextWindow(_model: string): { tokens: number; label: string } {
  return { tokens: CONTEXT_WINDOW_TOKENS, label: '100k' };
}

export function buildContextUsage(
  model: string,
  messages: Array<{ role: string; content: unknown }>,
  opts: {
    historyMessageCount: number;
    dataContextIncluded: boolean;
    systemText: string;
    historyText: string;
    dataText: string;
    messageText: string;
  }
): ContextUsage {
  const { tokens: contextWindowTokens } = getModelContextWindow(model);
  const breakdown: ContextUsageBreakdown = {
    system: estimateTokensFromText(opts.systemText),
    history: estimateTokensFromText(opts.historyText),
    data: estimateTokensFromText(opts.dataText),
    message: estimateTokensFromText(opts.messageText),
  };
  const estimatedPromptTokens =
    breakdown.system + breakdown.history + breakdown.data + breakdown.message;

  return {
    estimatedPromptTokens,
    contextWindowTokens,
    historyMessageCount: opts.historyMessageCount,
    dataContextIncluded: opts.dataContextIncluded,
    model,
    breakdown,
  };
}

/** Когда подмешивать тяжёлый блок данных (сны, CRM) — не на каждый follow-up */
export function shouldAttachDataContext(
  historyLength: number,
  message: string,
  includeData: boolean
): boolean {
  if (!includeData) return false;
  if (historyLength === 0) return true;
  if (messageLooksLikeDreamAnalysis(message)) return true;
  if (/(клиент|база снов|обнови данные|заново|пересчит|актуальн.*сн|обнови сн)/i.test(message)) return true;
  return false;
}

export function messageLooksLikeDreamAnalysis(textRaw: unknown): boolean {
  const s = String(textRaw || '').toLowerCase();
  const hasDreamKeyword =
    /(сны|снов|снам|снами|снах|сон|сна|сну|сном|dream)/i.test(s) || /\bснф\b/i.test(s);
  const hasAnalyzeIntent =
    /(анализ|проанализ|провалид|валид|разбер|разбор|посмотр|просмотр|просмотри|глянь|оцени|исслед|сводк|паттерн|ревью|проверь)/i.test(s);
  return hasDreamKeyword && hasAnalyzeIntent;
}

export function dataContextSkippedHint(): string {
  return '\n\n[Контекст данных] Полные данные о снах и CRM в этот запрос не дублируются — опирайся на историю диалога выше. Если нужны свежие данные из базы, попроси обновить выборку снов.';
}

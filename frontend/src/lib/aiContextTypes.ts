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

export const AI_CONTEXT_WINDOW_TOKENS = 100_000;

/** ~95k токенов для данных проекта (chars/4) */
export const AI_CONTEXT_MAX_CHARS = 380_000;

/** Локальная оценка истории сообщений (chars/4) */
export function estimateLocalHistoryTokens(
  messages: Array<{ role: string; content: string }>
): number {
  return messages.reduce((acc, m) => acc + Math.ceil((m.content?.length || 0) / 4) + 8, 0);
}

/** Обновляет оценку контекста по текущим сообщениям и черновику ввода */
export function deriveDisplayContextUsage(
  base: ContextUsage | null,
  messages: Array<{ role: string; content: string }>,
  inputDraft: string
): ContextUsage | null {
  const messageTokens = Math.ceil(inputDraft.trim().length / 4);
  const historyTokens = estimateLocalHistoryTokens(messages);

  if (!base) {
    if (messages.length === 0 && !inputDraft.trim()) return null;
    return {
      estimatedPromptTokens: historyTokens + messageTokens + 1200,
      contextWindowTokens: AI_CONTEXT_WINDOW_TOKENS,
      historyMessageCount: messages.length,
      dataContextIncluded: false,
      model: '…',
      breakdown: { system: 1200, history: historyTokens, data: 0, message: messageTokens },
    };
  }

  const { breakdown } = base;
  return {
    ...base,
    historyMessageCount: messages.length,
    estimatedPromptTokens: breakdown.system + breakdown.data + historyTokens + messageTokens,
    breakdown: { ...breakdown, history: historyTokens, message: messageTokens },
  };
}

export function formatContextTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

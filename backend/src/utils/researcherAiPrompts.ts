/** Пресеты исследовательских промптов для AI-ассистента */

export type ResearchPromptId =
  | 'free'
  | 'jungian_archetypes'
  | 'symbol_frequency'
  | 'individuation_hypothesis'
  | 'cross_participant'
  | 'narrative_themes'
  | 'compensation_dynamics'
  | 'custom';

const RESEARCH_PROMPTS: Record<Exclude<ResearchPromptId, 'custom'>, string> = {
  free: '',

  jungian_archetypes: `Режим исследования: юнгианский архетипический анализ.
Задача: выявить повторяющиеся архетипические фигуры, мотивы и символические комплексы в переданных снах.
Структура ответа: (1) гипотезы об архетипах с опорой на тексты; (2) частота/устойчивость паттернов; (3) возможные компенсаторные динамики; (4) ограничения выборки и что проверить дальше.
Не выдумывай сны — опирайся только на переданный контекст.`,

  symbol_frequency: `Режим исследования: частотный и структурный анализ символов.
Задача: составить обзор наиболее частых символов, их сочетаний и контекстов появления.
Структура: таблица или список «символ → частота → типичный контекст → гипотеза»; отметь выбросы и редкие символы; предложи метрики для количественного исследования.`,

  individuation_hypothesis: `Режим исследования: гипотезы стадий индивидуации.
Задача: проверить, какие маркеры стадий индивидуации (Ego–Shadow–Anima/Animus–Self и др.) прослеживаются в снах.
Формулируй гипотезы, а не диагнозы; указывай противоречивые случаи и альтернативные объяснения.`,

  cross_participant: `Режим исследования: сравнительный межучастниковый анализ.
Задача: сравнить паттерны между участниками (по меткам Участник #…), не раскрывая личные данные.
Выдели общие и уникальные мотивы; предложи кластеры/группы сходства; отметь ограничения малой выборки.`,

  narrative_themes: `Режим исследования: нarrativный / тематический анализ.
Задача: выделить повторяющиеся сюжеты, роли, конфликты и разрешения в сновидениях.
Структура: список тем → примеры (краткие цитаты из контекста) → интерпретация в рамках аналитической психологии → идеи для кодирования в исследовании.`,

  compensation_dynamics: `Режим исследования: компенсаторная функция сна.
Задача: проанализировать, как сны могут компенсировать дневное сознание (Юнг): противоположные аффекты, архетипические коррекции, символические балансы.
Указывай, где данных недостаточно для вывода о компенсации.`,
};

export function normalizeResearchPromptId(raw: unknown): ResearchPromptId {
  const s = String(raw ?? 'free');
  if (s in RESEARCH_PROMPTS || s === 'custom') return s as ResearchPromptId;
  return 'free';
}

export function appendResearchPromptInstruction(
  systemPrompt: string,
  promptId: ResearchPromptId,
  customPrompt?: string
): string {
  if (promptId === 'custom') {
    const t = typeof customPrompt === 'string' ? customPrompt.trim() : '';
    if (!t) return systemPrompt;
    return `${systemPrompt}\n\nИсследовательская инструкция (пользовательский промпт):\n${t.slice(0, 4000)}`;
  }
  const block = RESEARCH_PROMPTS[promptId];
  if (!block) return systemPrompt;
  return `${systemPrompt}\n\n${block}`;
}

export function appendAnalysisMemory(systemPrompt: string, memory: string): string {
  const t = memory.trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}\n\nПамять анализа этого чата (продолжай с учётом предыдущих выводов):\n${t.slice(0, 5000)}`;
}

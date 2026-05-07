export const PSYCHOLOGIST_AI_SETTINGS_KEY = 'psychologist_ai_settings_v1';

export type PsychologistModalityId =
  | 'jungian_analytical'
  | 'psychoanalysis'
  | 'existential'
  | 'transpersonal'
  | 'transactional_analysis'
  | 'symbol_drama'
  | 'systemic_family'
  | 'psychosynthesis'
  | 'religious_oriented'
  | 'cbt'
  | 'spiritual_oriented'
  | 'art_therapy'
  | 'gestalt'
  ;

export type ResponseStyle = 'concise' | 'balanced' | 'detailed';
export type AiModelId =
  | 'anthropic/claude-sonnet-4.6'
  | 'deepseek/deepseek-v4-flash'
  | 'openai/gpt-4o-mini'
  | 'qwen/qwen3.5-flash-02-23'
  | 'x-ai/grok-4.3';

/** Период, за который в контекст ИИ подставляются сны (по дате создания записи) */
export type DreamsContextRange = '30d' | '90d' | '365d' | 'all';

export type PsychologistAiSettings = {
  model: AiModelId;
  modality: PsychologistModalityId;
  temperature: number;
  responseStyle: ResponseStyle;
  /** По умолчанию — календарный месяц (~30 дней) */
  dreamsContextRange: DreamsContextRange;
  /**
   * Подставлять ли сны и вкладку «Сны» в контекст ИИ.
   * Если выключено — даже в юнгианской модальности данные снов не передаются, ассистент не должен их обсуждать.
   */
  includeDreamsInContext: boolean;
};

export const MODALITY_OPTIONS: Array<{ id: PsychologistModalityId; label: string }> = [
  { id: 'jungian_analytical', label: 'Юнгианский анализ (аналитическая психология)' },
  { id: 'psychoanalysis', label: 'Психоанализ (психодинамическая психотерапия)' },
  { id: 'existential', label: 'Экзистенциальная психотерапия' },
  { id: 'transpersonal', label: 'Трансперсональная психотерапия' },
  { id: 'transactional_analysis', label: 'Транзактный анализ' },
  { id: 'symbol_drama', label: 'Символдрама' },
  { id: 'systemic_family', label: 'Системная семейная психотерапия' },
  { id: 'psychosynthesis', label: 'Психосинтез' },
  { id: 'religious_oriented', label: 'Религиозно-ориентированная психотерапия' },
  { id: 'cbt', label: 'Когнитивно-поведенческая психотерапия' },
  { id: 'spiritual_oriented', label: 'Духовно-ориентированная психотерапия' },
  { id: 'art_therapy', label: 'Арт-терапия' },
  { id: 'gestalt', label: 'Гештальт-подход' }
];

export const DEFAULT_PSYCHOLOGIST_AI_SETTINGS: PsychologistAiSettings = {
  model: 'deepseek/deepseek-v4-flash',
  modality: 'jungian_analytical',
  temperature: 0.7,
  responseStyle: 'balanced',
  dreamsContextRange: '30d',
  includeDreamsInContext: true
};

export const AI_MODEL_OPTIONS: Array<{
  id: AiModelId;
  label: string;
  expertiseTag: string;
  speedTag: string;
}> = [
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    expertiseTag: 'Экспертность: очень высокая',
    speedTag: 'Скорость: средняя'
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    expertiseTag: 'Экспертность: высокая',
    speedTag: 'Скорость: очень высокая'
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    expertiseTag: 'Экспертность: хорошая',
    speedTag: 'Скорость: высокая'
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    label: 'Qwen 3.5 Flash',
    expertiseTag: 'Экспертность: хорошая',
    speedTag: 'Скорость: высокая'
  },
  {
    id: 'x-ai/grok-4.3',
    label: 'Grok 4.3',
    expertiseTag: 'Экспертность: высокая',
    speedTag: 'Скорость: выше средней'
  }
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(partial: Partial<PsychologistAiSettings>): PsychologistAiSettings {
  const model = AI_MODEL_OPTIONS.some(m => m.id === partial.model)
    ? (partial.model as AiModelId)
    : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.model;
  const modality = MODALITY_OPTIONS.some(m => m.id === partial.modality)
    ? (partial.modality as PsychologistModalityId)
    : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.modality;
  const temperature =
    typeof partial.temperature === 'number' && Number.isFinite(partial.temperature)
      ? clamp(partial.temperature, 0, 1)
      : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.temperature;
  const responseStyle =
    partial.responseStyle === 'concise' || partial.responseStyle === 'detailed' || partial.responseStyle === 'balanced'
      ? partial.responseStyle
      : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.responseStyle;
  const dreamsContextRange =
    partial.dreamsContextRange === '30d' ||
    partial.dreamsContextRange === '90d' ||
    partial.dreamsContextRange === '365d' ||
    partial.dreamsContextRange === 'all'
      ? partial.dreamsContextRange
      : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.dreamsContextRange;
  const includeDreamsInContext =
    typeof partial.includeDreamsInContext === 'boolean'
      ? partial.includeDreamsInContext
      : DEFAULT_PSYCHOLOGIST_AI_SETTINGS.includeDreamsInContext;
  return { model, modality, temperature, responseStyle, dreamsContextRange, includeDreamsInContext };
}

export function loadPsychologistAiSettings(): PsychologistAiSettings {
  try {
    const raw = localStorage.getItem(PSYCHOLOGIST_AI_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PSYCHOLOGIST_AI_SETTINGS };
    const j = JSON.parse(raw) as Partial<PsychologistAiSettings> & { maxTokens?: number };
    const { maxTokens: _drop, ...rest } = j;
    return normalizeSettings(rest);
  } catch {
    return { ...DEFAULT_PSYCHOLOGIST_AI_SETTINGS };
  }
}

export function savePsychologistAiSettings(s: PsychologistAiSettings): void {
  localStorage.setItem(PSYCHOLOGIST_AI_SETTINGS_KEY, JSON.stringify(normalizeSettings(s)));
}

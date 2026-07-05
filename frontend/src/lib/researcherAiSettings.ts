import {
  DEFAULT_PSYCHOLOGIST_AI_SETTINGS,
  MODALITY_OPTIONS,
  normalizeSettings,
  type DreamsContextRange,
  type PsychologistAiSettings,
  type PsychologistModalityId,
  type ResponseStyle,
} from './psychologistAiSettings';

export const RESEARCHER_AI_SETTINGS_KEY = 'researcher_ai_settings_v1';

export type DreamSamplingMode =
  | 'recent'
  | 'all_in_range'
  | 'by_participant'
  | 'by_symbol'
  | 'random'
  | 'stratified';

export type ResearchPromptId =
  | 'free'
  | 'jungian_archetypes'
  | 'symbol_frequency'
  | 'individuation_hypothesis'
  | 'cross_participant'
  | 'narrative_themes'
  | 'compensation_dynamics'
  | 'custom';

export type ResearcherAiSettings = {
  modality: PsychologistModalityId;
  temperature: number;
  responseStyle: ResponseStyle;
  dreamsContextRange: DreamsContextRange;
  includeDreamsInContext: boolean;
  dreamSamplingMode: DreamSamplingMode;
  /** Сколько снов попадает в контекст одного запроса */
  dreamSampleSize: number;
  participantClientId: string;
  symbolFilter: string;
  researchPromptId: ResearchPromptId;
  customResearchPrompt: string;
};

export const RESEARCH_PROMPT_OPTIONS: Array<{ id: ResearchPromptId; label: string; description: string }> = [
  { id: 'free', label: 'Свободный режим', description: 'Без дополнительной исследовательской рамки' },
  { id: 'jungian_archetypes', label: 'Архетипический анализ', description: 'Архетипы, комплексы, повторяющиеся фигуры' },
  { id: 'symbol_frequency', label: 'Частота символов', description: 'Статистика и сочетания символов в выборке снов' },
  { id: 'individuation_hypothesis', label: 'Гипотезы индивидуации', description: 'Маркеры стадий индивидуации в снах' },
  { id: 'cross_participant', label: 'Межучастниковое сравнение', description: 'Общие и уникальные паттерны по участникам' },
  { id: 'narrative_themes', label: 'Сюжетные темы', description: 'Сюжеты, роли, конфликты и разрешения' },
  { id: 'compensation_dynamics', label: 'Компенсация', description: 'Компенсаторная функция сновидений' },
  { id: 'custom', label: 'Свой промпт', description: 'Ваша исследовательская инструкция' },
];

export const DREAM_SAMPLING_OPTIONS: Array<{ id: DreamSamplingMode; label: string }> = [
  { id: 'recent', label: 'Последние по дате' },
  { id: 'all_in_range', label: 'Все в периоде (до лимита)' },
  { id: 'by_participant', label: 'Один участник' },
  { id: 'by_symbol', label: 'Сны с символом' },
  { id: 'random', label: 'Случайная выборка' },
  { id: 'stratified', label: 'Равномерно по участникам' },
];

export const DREAM_SAMPLE_SIZE_OPTIONS = [20, 50, 100, 150, 200] as const;

export const DEFAULT_RESEARCHER_AI_SETTINGS: ResearcherAiSettings = {
  modality: DEFAULT_PSYCHOLOGIST_AI_SETTINGS.modality,
  temperature: DEFAULT_PSYCHOLOGIST_AI_SETTINGS.temperature,
  responseStyle: DEFAULT_PSYCHOLOGIST_AI_SETTINGS.responseStyle,
  dreamsContextRange: '90d',
  includeDreamsInContext: true,
  dreamSamplingMode: 'recent',
  dreamSampleSize: 50,
  participantClientId: '',
  symbolFilter: '',
  researchPromptId: 'free',
  customResearchPrompt: '',
};

export { MODALITY_OPTIONS, type DreamsContextRange, type ResponseStyle };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeResearcherSettings(partial: Partial<ResearcherAiSettings>): ResearcherAiSettings {
  const base = normalizeSettings(partial as Partial<PsychologistAiSettings>);
  const modes: DreamSamplingMode[] = [
    'recent',
    'all_in_range',
    'by_participant',
    'by_symbol',
    'random',
    'stratified',
  ];
  const dreamSamplingMode = modes.includes(partial.dreamSamplingMode as DreamSamplingMode)
    ? (partial.dreamSamplingMode as DreamSamplingMode)
    : DEFAULT_RESEARCHER_AI_SETTINGS.dreamSamplingMode;
  const dreamSampleSize =
    typeof partial.dreamSampleSize === 'number' && Number.isFinite(partial.dreamSampleSize)
      ? clamp(Math.round(partial.dreamSampleSize), 5, 200)
      : DEFAULT_RESEARCHER_AI_SETTINGS.dreamSampleSize;
  const researchPromptId = RESEARCH_PROMPT_OPTIONS.some((p) => p.id === partial.researchPromptId)
    ? (partial.researchPromptId as ResearchPromptId)
    : DEFAULT_RESEARCHER_AI_SETTINGS.researchPromptId;

  return {
    modality: base.modality,
    temperature: base.temperature,
    responseStyle: base.responseStyle,
    dreamsContextRange: base.dreamsContextRange,
    includeDreamsInContext: base.includeDreamsInContext,
    dreamSamplingMode,
    dreamSampleSize,
    participantClientId: typeof partial.participantClientId === 'string' ? partial.participantClientId : '',
    symbolFilter: typeof partial.symbolFilter === 'string' ? partial.symbolFilter : '',
    researchPromptId,
    customResearchPrompt: typeof partial.customResearchPrompt === 'string' ? partial.customResearchPrompt : '',
  };
}

export function loadResearcherAiSettings(): ResearcherAiSettings {
  try {
    const raw = localStorage.getItem(RESEARCHER_AI_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_RESEARCHER_AI_SETTINGS };
    return normalizeResearcherSettings(JSON.parse(raw) as Partial<ResearcherAiSettings>);
  } catch {
    return { ...DEFAULT_RESEARCHER_AI_SETTINGS };
  }
}

export function saveResearcherAiSettings(s: ResearcherAiSettings): void {
  localStorage.setItem(RESEARCHER_AI_SETTINGS_KEY, JSON.stringify(normalizeResearcherSettings(s)));
}

export function settingsToApiBody(settings: ResearcherAiSettings) {
  return {
    modality: settings.modality,
    temperature: settings.temperature,
    responseStyle: settings.responseStyle,
    dreamsContextRange: settings.dreamsContextRange,
    includeDreamsInContext: settings.includeDreamsInContext,
    dreamSamplingMode: settings.dreamSamplingMode,
    dreamSampleSize: settings.dreamSampleSize,
    participantClientId: settings.participantClientId || undefined,
    symbolFilter: settings.symbolFilter || undefined,
    researchPromptId: settings.researchPromptId,
    customResearchPrompt: settings.customResearchPrompt || undefined,
  };
}

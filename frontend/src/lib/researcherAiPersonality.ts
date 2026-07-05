export const RESEARCHER_PERSONALITY_STORAGE_KEY = 'researcher_ai_personality_v1';

export const RESEARCHER_PERSONALITY_EXAMPLE = `Роль и фокус:
— Исследователь аналитической психологии, интерес к снам и символике.

Как удобно получать ответы:
— Структурированно: гипотезы → опора на тексты → ограничения выборки → следующие шаги.
— Таблицы и списки для паттернов; явно отмечай, где данных мало.

Границы:
— Только обезличенные данные; без выдуманных снов и ПДн.`;

export function loadResearcherPersonalityText(): string {
  try {
    const t = localStorage.getItem(RESEARCHER_PERSONALITY_STORAGE_KEY);
    return typeof t === 'string' ? t : '';
  } catch {
    return '';
  }
}

export function saveResearcherPersonalityText(text: string): void {
  localStorage.setItem(RESEARCHER_PERSONALITY_STORAGE_KEY, text.trim());
}

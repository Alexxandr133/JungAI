/** Текст персонализации для AI (кто психолог, как отвечать). Хранится локально в браузере. */

export const PERSONALITY_STORAGE_KEY = 'psychologist_ai_personality_v1';
export const ONBOARDING_STORAGE_KEY = 'psychologist_ai_onboarding_v1';

export const PERSONALITY_EXAMPLE = `Роль и опыт:
— Практикующий психолог, индивидуальная терапия, интерес к работе со снами.

Как мне удобно получать ответы:
— Короткие абзацы и списки; сначала суть, потом детали при необходимости.
— Если не хватает данных — задавай уточняющие вопросы.

Темы и границы:
— Опора на выбранную модальность; без медицинских диагнозов и назначений.`;

export function loadPersonalityText(): string {
  try {
    const t = localStorage.getItem(PERSONALITY_STORAGE_KEY);
    return typeof t === 'string' ? t : '';
  } catch {
    return '';
  }
}

export function savePersonalityText(text: string): void {
  localStorage.setItem(PERSONALITY_STORAGE_KEY, text.trim());
}

export function hasCompletedAiOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAiOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
}

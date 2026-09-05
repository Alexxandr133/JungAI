import { api } from '../../../lib/api';
import { ASSOCIATION_WORDS_100 } from './associationWords';

export type SessionTestSettings = {
  associationWords: string[];
};

export function defaultAssociationWords() {
  return [...ASSOCIATION_WORDS_100];
}

export function sanitizeWordBank(raw: unknown): string[] {
  if (!Array.isArray(raw)) return defaultAssociationWords();
  const words = raw.map((w) => String(w || '').trim()).filter(Boolean);
  return words.length ? words : defaultAssociationWords();
}

export async function loadSessionTestSettings(token?: string): Promise<SessionTestSettings> {
  if (!token) return { associationWords: defaultAssociationWords() };
  try {
    const res = await api<SessionTestSettings>('/api/psychologist/session-test-settings', { token });
    return { associationWords: sanitizeWordBank(res.associationWords) };
  } catch {
    return { associationWords: defaultAssociationWords() };
  }
}

export async function saveSessionTestSettings(token: string, settings: SessionTestSettings) {
  return api<SessionTestSettings>('/api/psychologist/session-test-settings', {
    method: 'PUT',
    token,
    body: { associationWords: sanitizeWordBank(settings.associationWords) }
  });
}

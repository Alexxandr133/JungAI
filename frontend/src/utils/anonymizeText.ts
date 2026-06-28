/** Клиентское обезличивание (гостевые сны из localStorage и превью) */

const GEO_PATTERNS: RegExp[] = [
  /южн(?:ая|\.?\s*осетия|\.?\s*осет)/gi,
  /север(?:ная|\.?\s*осетия|\.?\s*осет)/gi,
  /республик(?:а|и)\s+(?:северной\s+)?осет/gi,
  /осет(?:ия|ии|ию|ией)/gi,
  /алania|алания/gi,
  /владикавказ/gi,
  /назран(?:ь|и)/gi,
  /москв(?:а|е|у|ы)/gi,
  /санкт[-\s]?петербург/gi,
  /г\.\s*[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/g,
  /город(?:е|а|у)?\s+[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/gi,
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|\b\d{10,11}\b/g;
const FULL_NAME_RE = /\b[А-ЯA-Z][а-яa-z]{2,}\s+[А-ЯA-Z][а-яa-z]{2,}(?:\s+[А-ЯA-Z][а-яa-z]{2,})?\b/g;

export function anonymizeText(text: string | null | undefined, knownNames: string[] = []): string {
  if (!text || typeof text !== 'string') return '';

  let result = text;

  for (const name of knownNames) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[имя]');
  }

  result = result.replace(EMAIL_RE, '[email]');
  result = result.replace(PHONE_RE, '[телефон]');

  for (const re of GEO_PATTERNS) {
    result = result.replace(re, '[место]');
  }

  result = result.replace(FULL_NAME_RE, '[имя]');

  return result.replace(/\s{2,}/g, ' ').trim();
}

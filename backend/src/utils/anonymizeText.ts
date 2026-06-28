/** Обезличивание текста для исследовательского доступа (152-ФЗ, минимизация ПДн) */

const GEO_PATTERNS: RegExp[] = [
  /южн(?:ая|\.?\s*осетия|\.?\s*осет)/gi,
  /север(?:ная|\.?\s*осетия|\.?\s*осет)/gi,
  /республик(?:а|и)\s+(?:северной\s+)?осет/gi,
  /осет(?:ия|ии|ию|ией)/gi,
  /алания/gi,
  /владикавказ/gi,
  /назран(?:ь|и)/gi,
  /москв(?:а|е|у|ы)/gi,
  /санкт[-\s]?петербург/gi,
  /росси(?:я|и|ю|ей)/gi,
  /г\.\s*[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/g,
  /город(?:е|а|у)?\s+[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/gi,
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|\b\d{10,11}\b/g;
const URL_RE = /https?:\/\/[^\s]+/gi;

/** «Иван Петров», «Мария» — осторожно: только явные ФИО-подобные конструкции */
const FULL_NAME_RE = /\b[А-ЯA-Z][а-яa-z]{2,}\s+[А-ЯA-Z][а-яa-z]{2,}(?:\s+[А-ЯA-Z][а-яa-z]{2,})?\b/g;

export type AnonymizeOptions = {
  /** Имя клиента из БД — заменяется первым */
  knownNames?: string[];
};

export function anonymizeText(text: string | null | undefined, options: AnonymizeOptions = {}): string {
  if (!text || typeof text !== 'string') return '';

  let result = text;

  for (const name of options.knownNames ?? []) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[имя]');
  }

  result = result.replace(EMAIL_RE, '[email]');
  result = result.replace(PHONE_RE, '[телефон]');
  result = result.replace(URL_RE, '[ссылка]');

  for (const re of GEO_PATTERNS) {
    result = result.replace(re, '[место]');
  }

  result = result.replace(FULL_NAME_RE, '[имя]');

  return result.replace(/\s{2,}/g, ' ').trim();
}

export function anonymizeDreamRecord(dream: {
  id: string;
  title?: string | null;
  content?: string | null;
  symbols?: unknown;
  symbolsStatus?: string | null;
  createdAt: Date | string;
  clientId?: string | null;
  client?: { id?: string; name?: string | null } | null;
}) {
  const knownNames = dream.client?.name ? [dream.client.name] : [];
  const clientId = dream.clientId ?? dream.client?.id;
  const status = dream.symbolsStatus || 'ready';
  const symbols =
    status === 'pending' || status === 'processing' || status === 'failed'
      ? []
      : dream.symbols;

  return {
    id: dream.id,
    title: anonymizeText(dream.title || 'Без названия', { knownNames }),
    content: anonymizeText(dream.content, { knownNames }),
    symbols,
    symbolsStatus: status,
    createdAt: dream.createdAt,
    clientId: clientId ?? undefined,
    participantLabel: clientId ? `Участник #${String(clientId).slice(-6).toUpperCase()}` : undefined,
    source: 'client' as const
  };
}

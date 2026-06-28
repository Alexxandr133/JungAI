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
  /мальдив(?:ы|ах|ам|ами|ов)?/gi,
  /г\.\s*[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/g,
  /город(?:е|а|у)?\s+[А-ЯA-Z][а-яa-z-]+(?:\s+[А-ЯA-Z][а-яa-z-]+)?/gi,
  /(?:на|в|из|к|от)\s+[А-ЯA-Z][а-яa-z]{3,}(?:ах|ях|е|у|и|ы|а|я|ой|ую)?/gi,
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|\b\d{10,11}\b/g;
const URL_RE = /https?:\/\/[^\s]+/gi;
const FULL_NAME_RE = /\b[А-ЯA-Z][а-яa-z]{2,}\s+[А-ЯA-Z][а-яa-z]{2,}(?:\s+[А-ЯA-Z][а-яa-z]{2,})?\b/g;
const LATIN_NAME_RE = /\b[A-Z][a-z]{2,}(?:'s|s)?\b/g;

/** Имена с русскими падежными окончаниями: Динаре, Лие, Мальдивах, Лия */
const PROPER_NAME_RE =
  /\b[А-ЯA-Z][а-яa-z]{2,}(?:ах|ях|ами|ями|ой|ую|ою|ей|ие|ии|е|у|а|я|ы|и|о|ь)?\b/g;

const NAME_STOP_WORDS = new Set([
  'он', 'она', 'оно', 'они', 'мы', 'вы', 'я', 'ты', 'это', 'тот', 'та', 'те', 'том', 'той',
  'все', 'весь', 'вся', 'кто', 'что', 'где', 'когда', 'как', 'если', 'или', 'ли', 'же', 'бы',
  'был', 'была', 'было', 'были', 'есть', 'нет', 'стал', 'стала', 'стало', 'стали', 'будет',
  'сон', 'сны', 'сна', 'сне', 'сну', 'снов', 'снами',
  'дом', 'дома', 'доме', 'дому', 'комната', 'комнате', 'комнату', 'улица', 'улице', 'улицу',
  'город', 'городе', 'городу', 'море', 'моря', 'морю', 'небо', 'неба', 'лес', 'лесу', 'леса',
  'река', 'реке', 'реку', 'окно', 'окне', 'окна', 'дверь', 'двери', 'дверью',
  'утро', 'день', 'ночь', 'ночи', 'ночью', 'вечер', 'вечера', 'зима', 'лето', 'осень', 'весна',
  'мама', 'папа', 'мать', 'отец', 'брат', 'сестра', 'бабушка', 'дедушка', 'дочь', 'сын',
  'бог', 'бога', 'богу', 'дьявол', 'ангел', 'ангела',
  'россия', 'россии', 'россию', 'россией',
  'школа', 'школе', 'школу', 'работа', 'работе', 'работу', 'офис', 'офисе',
  'машина', 'машине', 'машину', 'автобус', 'автобусе', 'поезд', 'поезде',
  'вода', 'воде', 'огонь', 'огня', 'огне', 'свет', 'света', 'свете', 'тьма', 'тьме',
  'человек', 'человека', 'люди', 'людей', 'мужчина', 'женщина', 'ребенок', 'ребенка', 'дети',
  'the', 'and', 'for', 'with', 'from',
]);

export type AnonymizeOptions = {
  knownNames?: string[];
};

function expandKnownNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 2) continue;
    out.add(trimmed);
    for (const part of trimmed.split(/\s+/)) {
      if (part.length >= 2) out.add(part);
    }
  }
  return [...out];
}

function replaceKnownNames(text: string, knownNames: string[]): string {
  let result = text;
  const expanded = expandKnownNames(knownNames).sort((a, b) => b.length - a.length);
  for (const name of expanded) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[имя]');
    // Падежные формы известного имени: Динар → Динаре, Динару…
    if (/^[А-ЯA-Z][а-яa-z]{3,}$/i.test(name)) {
      const base = escaped;
      result = result.replace(new RegExp(`${base}(?:[еуюой]|ах|ях|ами|ями|ом|ем|ы|и|а|я)?`, 'gi'), '[имя]');
    }
  }
  return result;
}

export function anonymizeText(text: string | null | undefined, options: AnonymizeOptions = {}): string {
  if (!text || typeof text !== 'string') return '';

  let result = text;

  result = replaceKnownNames(result, options.knownNames ?? []);

  result = result.replace(EMAIL_RE, '[email]');
  result = result.replace(PHONE_RE, '[телефон]');
  result = result.replace(URL_RE, '[ссылка]');

  for (const re of GEO_PATTERNS) {
    result = result.replace(re, '[место]');
  }

  result = result.replace(FULL_NAME_RE, '[имя]');
  result = result.replace(LATIN_NAME_RE, '[имя]');
  result = result.replace(PROPER_NAME_RE, (match) => {
    if (match.length < 3) return match;
    if (NAME_STOP_WORDS.has(match.toLowerCase())) return match;
    return '[имя]';
  });

  return result.replace(/\s{2,}/g, ' ').trim();
}

function anonymizeSymbols(symbols: unknown, knownNames: string[]): unknown {
  if (!Array.isArray(symbols)) return symbols;
  return symbols.map((s) => (typeof s === 'string' ? anonymizeText(s, { knownNames }) : s));
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
  const rawSymbols =
    status === 'pending' || status === 'processing' || status === 'failed'
      ? []
      : dream.symbols;
  const symbols = anonymizeSymbols(rawSymbols, knownNames);

  return {
    id: dream.id,
    title: anonymizeText(dream.title || 'Без названия', { knownNames }),
    content: anonymizeText(dream.content, { knownNames }),
    symbols,
    symbolsStatus: status,
    createdAt: dream.createdAt,
    clientId: clientId ?? undefined,
    participantLabel: clientId ? `Участник #${String(clientId).slice(-6).toUpperCase()}` : undefined,
    source: 'client' as const,
  };
}

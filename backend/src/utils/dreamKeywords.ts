/**
 * Извлечение «символов» из снов: токены, стоп-слова, отсев прилагательных/причастий,
 * приведение глаголов к инфинитиву (горел → гореть), стеммер для склейки форм.
 */

import natural from 'natural';

export function symbolKey(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

/** Частые русские служебные слова и «шум» для снов (расширяемый список) */
const STOP_WORDS = new Set(
  `
и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет
о из ему теперь когда даже ну вдруг ли если уже или ни быть при без раз ж из-за из-под над под перед через
это эта эти этот том тут там туда здесь куда откуда почему зачем какой какая какие какое какого которого
который которой которых которым которыми кто что чем кому чему чём него неё них ним ними ней
мой моя мое мои твой твоя твоё твои наш наша наше наши ваш ваша ваше ваши свой своя своё свои сам сама сами само
себя собой собою ему ей им них ей ею его её их мне тебе вам нам вас нас вами нами собой
был были была быть буду будем будете будут будь будьте есть стал стала стало стали
очень более менее тоже также уже ещё опять снова весь вся всё всего всем всеми всю всей всем
один одна одно одни одним одной одному одних
два две двум двумя двух три четыре пять много мало несколько сколько
где куда откуда туда сюда везде нигде вдруг вновь опять
может можно нельзя нужно надо хочу хотел хотела хотели хочет хотят
эту этих этим этими той тех тем теми ту той
просто простой простая весьма вроде лишь только лишь чуть едва
время раза разу разом разах минут час день ночь год лет года году
сегодня вчера завтра сейчас потом потому поэтому зато однако либо
вместо вместе всех дальше больше меньше
как будто ведь вон даже едва ли ибо либо неужели ну вот
очень весь вся все всю всем всеми весьма
между среди около возле внутри вне снаружи
который которая которое которые
чтобы чтоб ели едва
думал думала думали думаю думает думать видел видела видели вижу видит видеть
сказал сказала сказали говорил говорила говорят говорить шёл шла шли идти шёл
было стало стали стать казалось кажется кажется
очень очень
`.split(/\s+/).filter(Boolean)
);

const NOUN_SURFACE_EXCEPTIONS = new Set(
  `герой герои товар товары лагерь лагеря мать отец дети дитя имя имена время времена пламя знамя путь пути
стул стол люди камень корень племя край море поле солнце сердце небо`.split(/\s+/).filter(Boolean)
);

/** Не конвертировать в инфинитив (омонимы / ложные срабатывания) */
const VERB_LEMMA_BLOCKLIST = new Set(['смел', 'смела', 'смели', 'смело']);

/** Слова, которые технически выглядят как существительные, но для символов чаще всего шум */
const BLOCK_SYMBOLS = new Set(
  `
голова головы
`.split(/\s+/).filter(Boolean)
);

/** Существительные на -ал / похожие на глагол, но не «читал→читать» */
const NOUN_NOT_VERB_AL = new Set(
  `минерал капитал универсал сигнал портал интервал канал ритуал оригинал идеал генерал адмирал
  карнавал фестиваль базал вертикаль горизонталь декаль медаль педаль муниципал`.split(/\s+/).filter(Boolean)
);

/**
 * Неправильные и частые формы прошедшего → инфинитив (расширяйте по мере необходимости).
 */
const IRREGULAR_VERB_TO_INFINITIVE: Record<string, string> = {
  шёл: 'идти',
  шла: 'идти',
  шли: 'идти',
  шло: 'идти',
  шел: 'идти',
  пошёл: 'идти',
  пошла: 'идти',
  пошли: 'идти',
  пошло: 'идти',
  бежал: 'бежать',
  бежала: 'бежать',
  бежали: 'бежать',
  бежало: 'бежать',
  мог: 'мочь',
  могла: 'мочь',
  могли: 'мочь',
  могло: 'мочь',
  смог: 'мочь',
  смогла: 'мочь',
  смогли: 'мочь',
  вёл: 'вести',
  вела: 'вести',
  вели: 'вести',
  вел: 'вести',
  нёс: 'нести',
  несла: 'нести',
  несли: 'нести',
  нес: 'нести',
  взял: 'взять',
  взяла: 'взять',
  взяли: 'взять',
  понял: 'понять',
  поняла: 'понять',
  поняли: 'понять',
  пришёл: 'прийти',
  пришла: 'прийти',
  пришли: 'прийти',
  пришел: 'прийти',
  ушёл: 'уйти',
  ушла: 'уйти',
  ушли: 'уйти',
  ушел: 'уйти',
  нашёл: 'найти',
  нашла: 'найти',
  нашли: 'найти',
  нашел: 'найти',
  умел: 'уметь',
  умела: 'уметь',
  умели: 'уметь',
  дал: 'дать',
  дала: 'дать',
  дали: 'дать',
  пил: 'пить',
  пила: 'пить',
  пили: 'пить',
  жил: 'жить',
  жила: 'жить',
  жили: 'жить',
  спал: 'спать',
  спала: 'спать',
  спали: 'спать',
  вышел: 'выйти',
  вышла: 'выйти',
  вышли: 'выйти',
  вышло: 'выйти'
};

const WORD_RE = /[\p{L}\p{M}]{3,}/gu;
const MAX_WORD_LEN = 32;

export const MAX_SYMBOLS_PER_DREAM = 10;

export type WordAgg = Map<string, { count: number; display: string }>;

/**
 * Канонизация «символов» (смысловых единиц).
 * Важно: ключ — это НОРМАЛИЗОВАННАЯ форма (lowercase), значение — отображаемое имя символа.
 * Это нужно, чтобы считать «сколько снов за день содержали символ», а не повторы внутри одного сна.
 */
const CANONICAL_SYMBOL_MAP: Record<string, string> = {
  // силовые структуры
  фсб: 'ФСБ',
  фсбшник: 'ФСБ',
  фсбшники: 'ФСБ',
  фсбшников: 'ФСБ',
  фсбшниками: 'ФСБ',
  фсбшникам: 'ФСБ',
  фсбшнике: 'ФСБ',
  фсбшником: 'ФСБ',

  полиция: 'Полиция',
  полицейский: 'Полиция',
  полицейские: 'Полиция',
  мент: 'Полиция',
  менты: 'Полиция',
  коп: 'Полиция',
  копы: 'Полиция',
  копик: 'Полиция',
  копики: 'Полиция',

  // базовые смысловые действия/события (сведение глаголов к существительным)
  обыскать: 'обыск',
  обыскивать: 'обыск',
  обыск: 'обыск',
  обыскатьcя: 'обыск',
  досмотр: 'обыск',
  досматривать: 'обыск',
  досмотрели: 'обыск',

  бежать: 'бег',
  побежать: 'бег',
  бег: 'бег',
  убегать: 'бег',
  убежать: 'бег',

  // петля/зацикливание
  зацикливаться: 'зацикливание',
  зацикливание: 'зацикливание',
  петля: 'зацикливание',
  бесконечный: 'зацикливание',
  бесконечная: 'зацикливание',
  бесконечной: 'зацикливание',

  // выход / переход (как символ, если явно встречается)
  выйти: 'выход',
  выходить: 'выход',
  выход: 'выход',
  выхожу: 'выход',
  выходя: 'выход',
  выходят: 'выход'
};

/** Эвристика: прилагательные и причастия (инфинитивы глаголов оставляем как символы). */
function isLikelyRussianAdjectiveVerbParticiple(t: string): boolean {
  if (NOUN_SURFACE_EXCEPTIONS.has(t)) return false;
  if (t.length < 4) return false;
  if (/(ыми|ими|ым|им|ого|его|ому|ему|ую|юю)$/.test(t)) return true;
  if (/(ый|ий)$/.test(t) && t.length >= 5) return true;
  if (/(ая|яя)$/.test(t) && t.length >= 5) return true;
  if (/(ое|ее)$/.test(t) && t.length >= 5) return true;
  if (/(ые|ие)$/.test(t) && t.length >= 5) return true;
  if (
    /(ущий|ющий|ящий|вший|вшая|вшее|вшие|нный|нная|нное|нные|нной|нным|нную|емый|имый|тный|щая|щее|щие|щий)$/.test(
      t
    )
  )
    return true;
  if (/(я|а|в|ши)сь$/.test(t) && t.length > 5) return true;
  return false;
}

function isLikelyEnglishNonNoun(t: string): boolean {
  if (t.length < 4) return false;
  if (/(ing|ful|less|ous|ive|able|ible|ed)$/.test(t) && t.length > 5) return true;
  return false;
}

/** Эвристика: русские глаголы в настоящем/будущем времени (спряжение) */
function looksLikeRussianConjugatedVerb(t: string): boolean {
  if (t.length < 4) return false;
  // частые окончания: делаем/делает/делают/делаю/делаешь, идём/идете/идут и т.п.
  if (/(юсь|ешь|ет|ем|ём|ете|ёте|ут|ют|ишь|ит|им|ите|ат|ят)$/.test(t)) return true;
  // повелительное: сделай/сделайте — часто мусор в символах
  if (/(й|йте)$/.test(t) && t.length >= 5) return true;
  return false;
}

function nominativeSurfaceScore(t: string): number {
  if (NOUN_SURFACE_EXCEPTIONS.has(t)) return 5;
  if (/(ый|ий|ая|яя|ое|ее|ые|ие|ого|его|ому|ему|ую|юю|ыми|ими|нный|ющий|ящий|вший)$/i.test(t)) return 0;
  if (/[аоэеёиыу]$/i.test(t)) return 4;
  if (/ь$/i.test(t) && !/(ить|ать|еть|оть|уть|чь)$/i.test(t)) return 4;
  if (/[бвгджзйклмнпрстфхцчшщ]$/i.test(t)) return 3;
  if (/(ой|ей)$/i.test(t)) return 2;
  return 1;
}

/** Инфинитив и пр. «словарные» формы глагола — предпочтительнее для подписи. */
function displayPrecedence(k: string): number {
  if (/(ть|ти|чь)$/i.test(k)) return 6;
  if (/(ать|ять|еть|ить|уть)$/i.test(k)) return 5;
  if (NOUN_SURFACE_EXCEPTIONS.has(k)) return 5;
  return nominativeSurfaceScore(k);
}

function trySuffixPastToInfinitive(k: string): string | null {
  if (VERB_LEMMA_BLOCKLIST.has(k)) return null;
  if (k.length < 4) return null;

  let m = k.match(/^(.{3,})яли$/);
  if (m) return m[1] + 'ять';
  m = k.match(/^(.{3,})яла$/);
  if (m) return m[1] + 'ять';
  m = k.match(/^(.{3,})ял$/);
  if (m) return m[1] + 'ять';

  m = k.match(/^(.{3,})ели$/);
  if (m) return m[1] + 'еть';
  m = k.match(/^(.{3,})ела$/);
  if (m) return m[1] + 'еть';
  m = k.match(/^(.{3,})ел$/);
  if (m) return m[1] + 'еть';

  m = k.match(/^(.{3,})или$/);
  if (m) return m[1] + 'ить';
  m = k.match(/^(.{3,})ила$/);
  if (m) return m[1] + 'ить';
  m = k.match(/^(.{3,})ил$/);
  if (m) return m[1] + 'ить';

  if (!NOUN_NOT_VERB_AL.has(k)) {
    m = k.match(/^(.{3,})али$/);
    if (m) return m[1] + 'ать';
    m = k.match(/^(.{3,})ала$/);
    if (m) return m[1] + 'ать';
    m = k.match(/^(.{3,})ал$/);
    if (m) return m[1] + 'ать';
  }

  m = k.match(/^(.{3,})ули$/);
  if (m) return m[1] + 'уть';
  m = k.match(/^(.{3,})ула$/);
  if (m) return m[1] + 'уть';
  m = k.match(/^(.{3,})ул$/);
  if (m) return m[1] + 'уть';

  m = k.match(/^(.{2,})ыли$/);
  if (m) return m[1] + 'ыть';
  m = k.match(/^(.{2,})ыла$/);
  if (m) return m[1] + 'ыть';
  m = k.match(/^(.{2,})ыл$/);
  if (m) return m[1] + 'ыть';

  return null;
}

/**
 * Публично для тестов: приводит токен к «словарной» форме глагола, если удаётся (горел → гореть).
 */
export function coerceRussianVerbLemma(k: string): string {
  const lower = symbolKey(k);
  const irr = IRREGULAR_VERB_TO_INFINITIVE[lower];
  if (irr) return irr;
  const suff = trySuffixPastToInfinitive(lower);
  if (suff) return suff;
  return lower;
}

/** Осталась форма прошедшего/морфологический мусор, которую не смогли свести к инфинитиву. */
function looksLikeUnmappedPastVerb(k: string): boolean {
  if (NOUN_SURFACE_EXCEPTIONS.has(k) || VERB_LEMMA_BLOCKLIST.has(k)) return false;
  if (/(овал|овала|овали)$/.test(k)) return true;
  if (/(ла|ло|ли)$/.test(k) && k.length > 5) return true;
  if (
    /(ал|ала|али|ил|ила|или|ел|ела|ели|ял|яла|яли)$/.test(k) &&
    k.length > 5 &&
    !/(ить|ать|еть|ять|уть|оть|чь|ти)$/.test(k)
  )
    return true;
  return false;
}

function stemKey(token: string): string {
  const k = symbolKey(token);
  if (/[а-ё]/i.test(k)) {
    return natural.PorterStemmerRu.stem(k);
  }
  if (/[a-z]/i.test(k)) {
    return natural.PorterStemmer.stem(k);
  }
  return k;
}

function normalizeTokenToKeyDisplay(raw: string): { key: string; display: string } | null {
  const k0 = symbolKey(raw);
  if (!k0 || k0.length < 3 || k0.length > MAX_WORD_LEN || STOP_WORDS.has(k0)) return null;

  const lemma = coerceRussianVerbLemma(k0);
  if (lemma === k0 && looksLikeUnmappedPastVerb(k0)) return null;

  if (/[а-ё]/i.test(lemma)) {
    if (isLikelyRussianAdjectiveVerbParticiple(lemma)) return null;
  } else if (isLikelyEnglishNonNoun(k0)) return null;

  // Канонизация смысла по словарю (после лемматизации)
  const canon = CANONICAL_SYMBOL_MAP[lemma] ?? lemma;
  if (BLOCK_SYMBOLS.has(symbolKey(canon)) || BLOCK_SYMBOLS.has(symbolKey(lemma)) || BLOCK_SYMBOLS.has(k0)) return null;

  // По умолчанию выкидываем спряжённые глаголы, если они не сведены словарём к смысловому символу.
  // Это убирает мусор вроде «делаем/выхожу/начинают», оставляя «выход» через CANONICAL_SYMBOL_MAP.
  if (looksLikeRussianConjugatedVerb(lemma) && !Object.prototype.hasOwnProperty.call(CANONICAL_SYMBOL_MAP, lemma)) {
    return null;
  }
  // По умолчанию выкидываем «глаголы как символы», если они не сведены словарём к существительному смыслу.
  // Это убирает мусор вроде «решить», «начать», «увидеть», оставляя «обыск/бег/…» через CANONICAL_SYMBOL_MAP.
  if (canon === lemma && /(ть|ти|чь)$/i.test(lemma) && !Object.prototype.hasOwnProperty.call(CANONICAL_SYMBOL_MAP, lemma)) {
    return null;
  }
  const key = stemKey(canon);
  const display = CANONICAL_SYMBOL_MAP[lemma] ?? (lemma !== k0 ? lemma : raw.normalize('NFKC').trim());
  if (!display || STOP_WORDS.has(symbolKey(display))) return null;
  return { key, display };
}

function recordToken(agg: WordAgg, raw: string) {
  const norm = normalizeTokenToKeyDisplay(raw);
  if (!norm) return;
  const { key, display } = norm;

  const prev = agg.get(key);
  if (!prev) {
    agg.set(key, { count: 1, display });
    return;
  }
  prev.count += 1;
  if (displayPrecedence(symbolKey(display)) > displayPrecedence(symbolKey(prev.display))) {
    prev.display = display;
  }
}

export function aggregateWordFrequencyFromTexts(
  rows: Array<{ title: string; content: string }>
): WordAgg {
  const agg: WordAgg = new Map();
  for (const row of rows) {
    const blob = `${row.title || ''}\n${row.content || ''}`;
    const matches = blob.match(WORD_RE);
    if (!matches) continue;
    for (const raw of matches) {
      recordToken(agg, raw);
    }
  }
  return agg;
}

export function topWordsFromAgg(agg: WordAgg, limit: number): Array<{ symbol: string; count: number }> {
  return [...agg.entries()]
    .map(([, v]) => ({ symbol: v.display, count: v.count }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol, 'ru'))
    .slice(0, limit);
}

/**
 * Вариант A (объяснимый): считаем «сколько снов содержали символ» за день.
 * Внутри одного сна один символ учитывается максимум 1 раз (дедуп).
 */
export function aggregateSymbolFrequencyByDreamPresence(
  rows: Array<{ title: string; content: string }>
): WordAgg {
  const agg: WordAgg = new Map();

  for (const row of rows) {
    const blob = `${row.title || ''}\n${row.content || ''}`;
    const matches = blob.match(WORD_RE);
    if (!matches) continue;

    const perDreamKeys = new Set<string>();
    const perDreamDisplay = new Map<string, string>();

    for (const raw of matches) {
      const norm = normalizeTokenToKeyDisplay(raw);
      if (!norm) continue;
      if (perDreamKeys.has(norm.key)) continue;
      perDreamKeys.add(norm.key);
      perDreamDisplay.set(norm.key, norm.display);
    }

    for (const key of perDreamKeys) {
      const display = perDreamDisplay.get(key) || key;
      const prev = agg.get(key);
      if (!prev) {
        agg.set(key, { count: 1, display });
      } else {
        prev.count += 1;
        if (displayPrecedence(symbolKey(display)) > displayPrecedence(symbolKey(prev.display))) {
          prev.display = display;
        }
      }
    }
  }

  return agg;
}

export function extractDreamSymbolCandidates(
  title: string,
  content: string,
  maxTerms = MAX_SYMBOLS_PER_DREAM
): string[] {
  const perDream = aggregateWordFrequencyFromTexts([{ title: title || '', content: content || '' }]);
  return topWordsFromAgg(perDream, maxTerms).map((x) => x.symbol);
}

function parseIncomingSymbols(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      for (const part of item.split(/[,;|]/)) {
        const t = part.normalize('NFKC').trim();
        if (t) out.push(t);
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    const t = raw.normalize('NFKC').trim();
    if (!t) return [];
    try {
      return parseIncomingSymbols(JSON.parse(t) as unknown);
    } catch {
      return t.split(/[,;|]/).map((p) => p.normalize('NFKC').trim()).filter(Boolean);
    }
  }
  return [];
}

export function mergeDreamKeywords(title: string, content: string, clientSymbols: unknown): string[] {
  const manual = parseIncomingSymbols(clientSymbols);
  const extracted = extractDreamSymbolCandidates(title, content, MAX_SYMBOLS_PER_DREAM);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const s of manual) {
    const k0 = symbolKey(s);
    const lemma = coerceRussianVerbLemma(k0);
    const key = stemKey(lemma);
    if (!k0 || seen.has(key)) continue;
    seen.add(key);
    out.push(lemma !== k0 ? lemma : s.normalize('NFKC').trim());
    if (out.length >= MAX_SYMBOLS_PER_DREAM) return out;
  }
  for (const s of extracted) {
    const key = stemKey(coerceRussianVerbLemma(symbolKey(s)));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SYMBOLS_PER_DREAM) break;
  }
  return out;
}

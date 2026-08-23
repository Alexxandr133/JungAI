import { prisma } from '../db/prisma';
import { idsWithSearchOff } from './acceptingClients';
import { dayPartFromDate, listFreeSlots, mergeCalendarPrefs, type FreeSlot } from './calendarSlots';

/** Синхрон со срезом shared MATCH_TOPIC_TAGS (не весь словарь профиля) */
export const MATCH_TOPICS = [
  'Тревога и стресс',
  'Отношения',
  'Самооценка',
  'Утрата',
  'Выгорание',
  'Сны и кошмары',
  'Самопонимание',
  'Жизненные перемены',
  'Депрессия и апатия',
  'Панические атаки',
  'Семейные конфликты',
  'Травма и ПТСР',
  'Зависимости',
  'Работа с гневом',
  'Кризис идентичности',
  'Телесные симптомы',
] as const;

export const PRICE_BANDS = [
  { id: 'budget', min: 0, max: 3500, label: 'до 3 500 ₽' },
  { id: 'mid', min: 3500, max: 5500, label: '3 500 – 5 500 ₽' },
  { id: 'premium', min: 5500, max: null as number | null, label: 'от 5 500 ₽' },
] as const;

export type WhoFor = 'self' | 'couple' | 'child';
export type TimePreference = 'morning' | 'day' | 'evening' | 'any' | 'slot';

export type MatchQuery = {
  whoFor: WhoFor;
  topics: string[];
  customTopic?: string | null;
  timePreference: TimePreference;
  preferredSlotStart?: Date | null;
  preferredSlotEnd?: Date | null;
  priceMin?: number | null;
  priceMax?: number | null;
  methodNotes?: string | null;
  limit?: number;
  offset?: number;
  /** §14.3 релаксация */
  ignorePrice?: boolean;
  ignoreAudience?: boolean;
};

export type MatchCard = {
  id: string;
  name: string;
  bio: string | null;
  specialization: string[];
  therapyMethod: string | null;
  worksWith: string[];
  audienceFormats: string[];
  experience: number;
  avatarUrl: string | null;
  sessionPriceRub: number | null;
  nearestSlot: FreeSlot | null;
  score: number;
  reasons: string[];
  /** Совпавшие теги для подсветки в карточке */
  matchedTopics: string[];
  matchLine: string;
  catalogSortOrder: number;
  topicHits: number;
};

function asStringArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* plain string */
    }
    return raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeWhoFor(v: unknown): WhoFor {
  if (v === 'couple' || v === 'child' || v === 'self') return v;
  if (v === 'individual') return 'self';
  return 'self';
}

export function parseMatchBody(body: any): MatchQuery {
  const topics = Array.isArray(body?.topics) ? body.topics.map(String).slice(0, 3) : [];
  const customTopic = typeof body?.customTopic === 'string' ? body.customTopic.trim().slice(0, 300) : null;
  const whoFor = normalizeWhoFor(body?.whoFor ?? body?.format);
  let timePreference: TimePreference = 'any';
  if (['morning', 'day', 'evening', 'any', 'slot', 'flexible'].includes(body?.timePreference)) {
    timePreference = body.timePreference === 'flexible' ? 'any' : body.timePreference;
  }
  const priceBand = PRICE_BANDS.find((b) => b.id === body?.priceBand);
  let priceMin = body?.priceMin != null ? Number(body.priceMin) : priceBand?.min ?? null;
  let priceMax = body?.priceMax != null ? Number(body.priceMax) : priceBand?.max ?? null;
  if (priceMin != null && !Number.isFinite(priceMin)) priceMin = null;
  if (priceMax != null && !Number.isFinite(priceMax)) priceMax = null;
  if (body?.ignorePrice) {
    priceMin = null;
    priceMax = null;
  }

  let preferredSlotStart: Date | null = null;
  let preferredSlotEnd: Date | null = null;
  if (body?.preferredSlotStart) {
    const d = new Date(body.preferredSlotStart);
    if (!Number.isNaN(d.getTime())) preferredSlotStart = d;
  }
  if (body?.preferredSlotEnd) {
    const d = new Date(body.preferredSlotEnd);
    if (!Number.isNaN(d.getTime())) preferredSlotEnd = d;
  }
  if (preferredSlotStart && timePreference !== 'slot') timePreference = 'slot';

  return {
    whoFor,
    topics,
    customTopic,
    timePreference,
    preferredSlotStart,
    preferredSlotEnd,
    priceMin,
    priceMax,
    methodNotes: typeof body?.methodNotes === 'string' ? body.methodNotes.slice(0, 400) : null,
    limit: Math.min(Math.max(Number(body?.limit) || 4, 1), 30),
    offset: Math.max(Number(body?.offset) || 0, 0),
    ignorePrice: Boolean(body?.ignorePrice),
    ignoreAudience: Boolean(body?.ignoreAudience),
  };
}

export async function runPsychologistMatch(query: MatchQuery): Promise<{ matches: MatchCard[]; total: number }> {
  const psychologists = await prisma.user.findMany({
    where: { role: 'psychologist', isVerified: true, catalogHidden: false },
    select: { id: true, email: true, catalogSortOrder: true },
    orderBy: [{ catalogSortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const searchOff = await idsWithSearchOff();
  const visible = psychologists.filter((p) => !searchOff.has(p.id));
  const ids = visible.map((p) => p.id);
  if (!ids.length) return { matches: [], total: 0 };

  const placeholders = ids.map(() => '?').join(',');
  let profiles: any[] = [];
  try {
    profiles = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Profile" WHERE "userId" IN (${placeholders})`,
      ...ids
    );
  } catch {
    profiles = await prisma.profile.findMany({ where: { userId: { in: ids } } });
  }
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const until = new Date(since);
  until.setDate(until.getDate() + 21);
  const events = await prisma.event.findMany({
    where: { createdBy: { in: ids }, startsAt: { gte: since, lte: until } },
    select: { createdBy: true, startsAt: true, endsAt: true },
  });
  const eventsByPsych = new Map<string, Array<{ startsAt: Date; endsAt: Date | null }>>();
  for (const ev of events) {
    if (!eventsByPsych.has(ev.createdBy)) eventsByPsych.set(ev.createdBy, []);
    eventsByPsych.get(ev.createdBy)!.push({ startsAt: ev.startsAt, endsAt: ev.endsAt });
  }

  const notesLower = (query.methodNotes || '').toLowerCase();

  const parseJsonField = (raw: unknown): unknown => {
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const scored: MatchCard[] = [];
  for (const psych of visible) {
    const profile = profileMap.get(psych.id);
    if (!profile) continue;

    const name = profile.name || psych.email.split('@')[0];
    const bio = profile.bio || null;
    const specs = asStringArray(parseJsonField(profile.specialization));
    const worksWith = asStringArray(parseJsonField(profile.worksWith));
    const audience = asStringArray(parseJsonField(profile.audienceFormats));
    const therapyMethod = profile.therapyMethod || specs[0] || null;
    const priceRaw = profile.sessionPriceRub;
    const price = priceRaw != null && Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : null;
    const exp = profile.experience ? parseInt(String(profile.experience), 10) || 0 : 0;
    const prefs = mergeCalendarPrefs(parseJsonField(profile.calendarPrefs));
    const freeSlots = listFreeSlots({
      prefs,
      events: eventsByPsych.get(psych.id) || [],
      daysAhead: 14,
      limit: 8,
    });
    const nearestSlot = freeSlots[0] || null;

    const hay = `${(bio || '').toLowerCase()} ${specs.join(' ').toLowerCase()} ${worksWith.join(' ').toLowerCase()} ${(therapyMethod || '').toLowerCase()} ${notesLower}`;

    const reasons: string[] = [];
    const matchParts: string[] = [];
    const matchedTopics: string[] = [];
    let score = 8;
    let topicHits = 0;

    // Audience
    if (!query.ignoreAudience) {
      if (audience.includes(query.whoFor)) {
        score += 28;
        matchParts.push('формат');
        reasons.push(
          query.whoFor === 'couple' ? 'Работает с парами' : query.whoFor === 'child' ? 'Работает с детьми' : 'Индивидуальная работа'
        );
      } else if (query.whoFor === 'couple' && (hay.includes('пар') || hay.includes('сем'))) {
        score += 18;
        matchParts.push('формат');
        reasons.push('Работает с парами / семьёй');
      } else if (query.whoFor === 'child' && (hay.includes('дет') || hay.includes('подрост'))) {
        score += 18;
        matchParts.push('формат');
        reasons.push('Работает с детьми / подростками');
      } else if (query.whoFor === 'self') {
        score += 6;
      } else if (audience.length) {
        score -= 25;
      }
    }

    // Topics
    for (const topic of query.topics) {
      const t = topic.toLowerCase();
      if (!t) continue;
      const hitTag = worksWith.find((w) => w.toLowerCase() === t || w.toLowerCase().includes(t) || t.includes(w.toLowerCase()));
      if (hitTag || hay.includes(t)) {
        topicHits += 1;
        score += 16;
        matchedTopics.push(hitTag || topic);
      }
    }
    if (query.customTopic) {
      const ct = query.customTopic.toLowerCase();
      if (hay.includes(ct) || worksWith.some((w) => w.toLowerCase().includes(ct))) {
        topicHits += 1;
        score += 10;
      }
    }
    if (topicHits) {
      matchParts.push('темы');
      reasons.push(`Совпадение по запросу (${topicHits})`);
    }

    // Price
    if (!query.ignorePrice) {
      if (price != null) {
        const minOk = query.priceMin == null || price >= query.priceMin;
        const maxOk = query.priceMax == null || price <= query.priceMax;
        if (minOk && maxOk) {
          score += 20;
          matchParts.push('бюджет');
          reasons.push(`Сессия — ${price.toLocaleString('ru-RU')} ₽`);
        } else {
          score -= 40;
        }
      } else {
        score -= 5;
      }
    }

    // Time — v1 не жёсткий фильтр: только бонус, без сильного штрафа
    if (query.timePreference === 'any') {
      if (nearestSlot) {
        score += 8;
      }
    } else if (query.timePreference === 'slot' && query.preferredSlotStart) {
      const want = query.preferredSlotStart.getTime();
      const hit = freeSlots.some((s) => {
        const t = new Date(s.slotStart).getTime();
        return Math.abs(t - want) <= 45 * 60 * 1000;
      });
      if (hit) {
        score += 20;
        reasons.push('Свободен в выбранное время');
      }
    } else if (['morning', 'day', 'evening'].includes(query.timePreference)) {
      const partHit = freeSlots.some((s) => dayPartFromDate(new Date(s.slotStart)) === query.timePreference);
      if (partHit) {
        score += 12;
        reasons.push(
          query.timePreference === 'morning' ? 'Есть утренние слоты' : query.timePreference === 'day' ? 'Есть дневные слоты' : 'Есть вечерние слоты'
        );
      }
    }

    if (exp >= 3) {
      score += Math.min(12, exp);
    }
    if (therapyMethod) reasons.push(`Метод: ${therapyMethod}`);
    if (!reasons.length) reasons.push('Верифицированный специалист платформы');

    const matchLine = matchParts.length
      ? `Совпадение: ${[...new Set(matchParts)].join(' · ')}`
      : 'Верифицированный специалист платформы';

    scored.push({
      id: psych.id,
      name,
      bio,
      specialization: specs,
      therapyMethod,
      worksWith,
      audienceFormats: audience,
      experience: exp,
      avatarUrl: profile.avatarUrl || null,
      sessionPriceRub: price,
      nearestSlot,
      score,
      reasons: reasons.slice(0, 4),
      matchedTopics: [...new Set(matchedTopics)].slice(0, 6),
      matchLine,
      catalogSortOrder: Number(psych.catalogSortOrder) || 0,
      topicHits,
    });
  }

  // §14.3: по числу совпадений (topicHits + score), затем catalogSortOrder
  scored.sort((a, b) => {
    if (b.topicHits !== a.topicHits) return b.topicHits - a.topicHits;
    if (b.score !== a.score) return b.score - a.score;
    return a.catalogSortOrder - b.catalogSortOrder;
  });
  const filtered = scored.filter((m) => m.score > 0);
  const total = filtered.length;
  const slice = filtered.slice(query.offset || 0, (query.offset || 0) + (query.limit || 4));
  return { matches: slice, total };
}

export function formatQuestionnaireText(q: Record<string, unknown>): string {
  const whoMap: Record<string, string> = { self: 'Для себя', couple: 'Для пары', child: 'Для ребёнка' };
  const lines = [
    'Анкета подбора специалиста',
    `Для кого: ${whoMap[String(q.whoFor)] || q.whoFor || '—'}`,
    `Темы: ${Array.isArray(q.topics) ? (q.topics as string[]).join(', ') : '—'}`,
    q.customTopic ? `Своя формулировка: ${q.customTopic}` : null,
    q.priceBandLabel ? `Бюджет: ${q.priceBandLabel}` : null,
    q.slotLabel ? `Желаемое время: ${q.slotLabel}` : `Время: ${q.timePreference || 'любое'}`,
    q.contactName ? `Имя: ${q.contactName}` : null,
    q.contactEmail ? `Email: ${q.contactEmail}` : null,
    q.contactPhone ? `Телефон: ${q.contactPhone}` : null,
    q.note ? `Комментарий: ${q.note}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export type CompletenessResult = {
  complete: boolean;
  missing: Array<{ key: string; label: string }>;
};

export function computeProfileCompleteness(input: {
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  therapyMethod?: string | null;
  specialization?: string | null;
  sessionPriceRub?: number | null;
  worksWith?: unknown;
  audienceFormats?: unknown;
  educationCount: number;
}): CompletenessResult {
  const missing: Array<{ key: string; label: string }> = [];
  if (!input.name?.trim()) missing.push({ key: 'name', label: 'Имя' });
  if (!input.avatarUrl) missing.push({ key: 'avatar', label: 'Фото' });
  if (!input.bio?.trim() || input.bio.trim().length < 40) missing.push({ key: 'bio', label: 'О себе (коротко)' });
  if (!String(input.specialization || '').trim()) {
    missing.push({ key: 'specialization', label: 'Специализация' });
  }
  if (input.sessionPriceRub == null || input.sessionPriceRub <= 0) {
    missing.push({ key: 'sessionPriceRub', label: 'Стоимость сессии' });
  }
  if (!asStringArray(input.worksWith).length) missing.push({ key: 'worksWith', label: 'С чем работаете' });
  if (!asStringArray(input.audienceFormats).length) missing.push({ key: 'audienceFormats', label: 'С кем работаете' });
  if (input.educationCount < 1) missing.push({ key: 'educations', label: 'Образование (хотя бы одно)' });
  return { complete: missing.length === 0, missing };
}

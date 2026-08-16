import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';
import { listFreeSlots, mergeCalendarPrefs } from '../utils/calendarSlots';
import {
  PRICE_BANDS,
  MATCH_TOPICS,
  formatQuestionnaireText,
  parseMatchBody,
  runPsychologistMatch,
} from '../utils/matchEngine';
import { isEmailTransportConfigured, sendEmail } from '../utils/email';
import { config } from '../config';

const router = Router();

/** Порог публикации «сегодняшних» символов на главной (после крона / валидации за день). */
const SYMBOLS_PUBLISH_HOUR = 18;

function parseCleanedFrequency(raw: unknown): Array<{ symbol: string; count: number }> | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Array<{ symbol: string; count: number }>;
  } catch {
    return null;
  }
}

function asStringArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* ignore */
    }
    return raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function ensurePsychologistReviewsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PsychologistReview" (
      "id" TEXT PRIMARY KEY,
      "psychologistId" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "rating" INTEGER NOT NULL,
      "comment" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PsychologistReview_psychologistId_clientId_key"
    ON "PsychologistReview" ("psychologistId", "clientId");
  `);
}

let matchSchemaReady: Promise<void> | null = null;
async function ensureMatchCatalogSchema() {
  if (!matchSchemaReady) {
    matchSchemaReady = (async () => {
      const cols = async (table: string, col: string, ddl: string) => {
        try {
          const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("${table}")`)) as any[];
          if (!rows.some((r) => r.name === col)) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
          }
        } catch {
          /* ignore */
        }
      };
      await cols('Profile', 'sessionPriceRub', '"sessionPriceRub" INTEGER');
      await cols('Profile', 'therapyMethod', '"therapyMethod" TEXT');
      await cols('Profile', 'worksWith', '"worksWith" JSONB');
      await cols('Profile', 'audienceFormats', '"audienceFormats" JSONB');
      await cols('Profile', 'calendarPrefs', '"calendarPrefs" JSONB');
      await cols('Profile', 'coverUrl', '"coverUrl" TEXT');
      await cols('Profile', 'accentColor', '"accentColor" TEXT');
      await cols('SupportRequest', 'questionnaire', '"questionnaire" JSONB');
      await cols('CalendarPublicBookingRequest', 'questionnaire', '"questionnaire" JSONB');
      await cols('CalendarPublicBookingRequest', 'source', `"source" TEXT NOT NULL DEFAULT 'slot'`);
      await cols('Event', 'isFirstMeeting', '"isFirstMeeting" BOOLEAN NOT NULL DEFAULT 0');
      await cols('Event', 'guestName', '"guestName" TEXT');
      await cols('Event', 'guestEmail', '"guestEmail" TEXT');
      await cols('Event', 'guestPhone', '"guestPhone" TEXT');
      await cols('Event', 'guestQuestionnaire', '"guestQuestionnaire" JSONB');
      await cols('ClientMatchProfile', 'whoFor', `"whoFor" TEXT NOT NULL DEFAULT 'self'`);
      await cols('ClientMatchProfile', 'customTopic', '"customTopic" TEXT');
      await cols('ClientMatchProfile', 'preferredSlotStart', '"preferredSlotStart" DATETIME');
      await cols('ClientMatchProfile', 'preferredSlotEnd', '"preferredSlotEnd" DATETIME');
      await cols('ClientMatchProfile', 'priceMin', '"priceMin" INTEGER');
      await cols('ClientMatchProfile', 'priceMax', '"priceMax" INTEGER');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PsychologistEducation" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "kind" TEXT NOT NULL,
          "institution" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "yearFrom" INTEGER NOT NULL,
          "yearTo" INTEGER,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "PsychologistEducation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "PsychologistEducation_userId_idx" ON "PsychologistEducation"("userId");`
      );
    })();
  }
  await matchSchemaReady;
}

function mapPublicCard(psych: { id: string; email: string }, profile: any) {
  return {
    id: psych.id,
    name: profile?.name || psych.email.split('@')[0],
    email: psych.email,
    bio: profile?.bio || null,
    specialization: asStringArray(profile?.specialization),
    therapyMethod: profile?.therapyMethod || null,
    worksWith: asStringArray(profile?.worksWith),
    audienceFormats: asStringArray(profile?.audienceFormats),
    experience: profile?.experience ? parseInt(String(profile.experience)) || 0 : 0,
    avatarUrl: profile?.avatarUrl || null,
    coverUrl: profile?.coverUrl || null,
    accentColor: profile?.accentColor || null,
    sessionPriceRub: profile?.sessionPriceRub ?? null,
    verified: true,
  };
}

// Публичный список психологов (для гостей)
router.get('/public', async (req, res) => {
  try {
    await ensureMatchCatalogSchema();
    const psychologists = await prisma.user.findMany({
      where: {
        role: 'psychologist',
        isVerified: true,
        catalogHidden: false
      },
      select: {
        id: true,
        email: true,
        catalogSortOrder: true,
      },
      orderBy: [{ catalogSortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    const psychologistIds = psychologists.map(p => p.id);
    let profiles: any[] = [];
    if (psychologistIds.length) {
      const placeholders = psychologistIds.map(() => '?').join(',');
      try {
        profiles = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Profile" WHERE "userId" IN (${placeholders})`,
          ...psychologistIds
        );
      } catch {
        profiles = await prisma.profile.findMany({ where: { userId: { in: psychologistIds } } });
      }
    }
    const profileMap = new Map(profiles.map((p: any) => [p.userId, p]));

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const until = new Date(since);
    until.setDate(until.getDate() + 14);
    const events = psychologistIds.length
      ? await prisma.event.findMany({
          where: { createdBy: { in: psychologistIds }, startsAt: { gte: since, lte: until } },
          select: { createdBy: true, startsAt: true, endsAt: true },
        })
      : [];
    const eventsByPsych = new Map<string, Array<{ startsAt: Date; endsAt: Date | null }>>();
    for (const ev of events) {
      if (!eventsByPsych.has(ev.createdBy)) eventsByPsych.set(ev.createdBy, []);
      eventsByPsych.get(ev.createdBy)!.push({ startsAt: ev.startsAt, endsAt: ev.endsAt });
    }

    const parseJsonField = (raw: unknown): unknown => {
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    let reviewStats = new Map<string, { avg: number; count: number }>();
    try {
      await ensurePsychologistReviewsTable();
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "psychologistId", AVG("rating") as avgRating, COUNT(*) as cnt
         FROM "PsychologistReview" GROUP BY "psychologistId"`
      );
      reviewStats = new Map(
        rows.map((r) => [
          r.psychologistId,
          { avg: Number(r.avgRating || 0), count: Number(r.cnt || 0) },
        ])
      );
    } catch {
      /* no reviews table */
    }

    const { mergeCalendarPrefs, listFreeSlots } = await import('../utils/calendarSlots');

    const result = psychologists.map((psych) => {
      const profile = profileMap.get(psych.id);
      const card = mapPublicCard(psych, {
        ...profile,
        worksWith: parseJsonField(profile?.worksWith),
        audienceFormats: parseJsonField(profile?.audienceFormats),
        specialization: parseJsonField(profile?.specialization) ?? profile?.specialization,
      });
      const prefs = mergeCalendarPrefs(parseJsonField(profile?.calendarPrefs));
      const freeSlots = listFreeSlots({
        prefs,
        events: eventsByPsych.get(psych.id) || [],
        daysAhead: 7,
        limit: 1,
      });
      const stats = reviewStats.get(psych.id);
      return {
        ...card,
        nearestSlot: freeSlots[0] || null,
        rating: stats && stats.count >= 1 ? Number(stats.avg.toFixed(1)) : null,
        reviewsCount: stats && stats.count >= 1 ? stats.count : 0,
      };
    });

    res.json({ psychologists: result, total: result.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists' });
  }
});

/** Метаданные квиза подбора */
router.get('/match/meta', async (_req, res) => {
  res.json({
    topics: MATCH_TOPICS,
    priceBands: PRICE_BANDS,
    whoFor: [
      { id: 'self', label: 'Для себя' },
      { id: 'couple', label: 'Для пары' },
      { id: 'child', label: 'Для ребёнка' },
    ],
  });
});

/** Умный подбор — доступен гостям */
router.post('/match', async (req, res) => {
  try {
    await ensureMatchCatalogSchema();
    const query = parseMatchBody(req.body || {});
    const { matches, total } = await runPsychologistMatch(query);
    res.json({
      matches,
      total,
      query: {
        whoFor: query.whoFor,
        topics: query.topics,
        customTopic: query.customTopic,
        timePreference: query.timePreference,
        priceMin: query.priceMin,
        priceMax: query.priceMax,
      },
    });
  } catch (e: any) {
    console.error('match error', e);
    res.status(500).json({ error: e.message || 'Failed to match' });
  }
});

// Публичная статистика для главной — объявлено ДО /public/:id, иначе «stats» попадает в :id
router.get('/public/stats', async (req, res) => {
  try {
    const psychologistsCount = await prisma.user.count({
      where: {
        role: 'psychologist',
        isVerified: true
      }
    });

    const clientsCount = await prisma.client.count();

    const dreamsCount = await prisma.dream.count();

    const now = new Date();
    const sessionsCount = await prisma.event.count({
      where: {
        type: 'session',
        OR: [
          { endsAt: { lt: now } },
          {
            AND: [{ endsAt: null }, { startsAt: { lt: now } }],
          },
        ],
      },
    });

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const publishAfter = new Date(dayStart);
    publishAfter.setHours(SYMBOLS_PUBLISH_HOUR, 0, 0, 0);
    const dayIso = dayStart.toISOString();

    let topSymbolsToday: Array<{ symbol: string; count: number }> = [];

    try {
      if (now < publishAfter) {
        const prev = (await prisma.$queryRawUnsafe<any[]>(
          `SELECT "cleanedFrequency" FROM "DailyDreamSymbolValidation" WHERE "day" < ? ORDER BY "day" DESC LIMIT 1`,
          dayIso
        )) as any[];
        const parsed = parseCleanedFrequency(prev?.[0]?.cleanedFrequency);
        if (parsed) topSymbolsToday = parsed;
      } else {
        const todayRows = (await prisma.$queryRawUnsafe<any[]>(
          `SELECT "cleanedFrequency" FROM "DailyDreamSymbolValidation" WHERE "day" = ? LIMIT 1`,
          dayIso
        )) as any[];
        let parsed = parseCleanedFrequency(todayRows?.[0]?.cleanedFrequency);
        if (!parsed) {
          const prev = (await prisma.$queryRawUnsafe<any[]>(
            `SELECT "cleanedFrequency" FROM "DailyDreamSymbolValidation" WHERE "day" < ? ORDER BY "day" DESC LIMIT 1`,
            dayIso
          )) as any[];
          parsed = parseCleanedFrequency(prev?.[0]?.cleanedFrequency);
        }
        if (parsed) topSymbolsToday = parsed;
      }
    } catch {
      // таблицы нет — оставляем пустой массив (демо на фронте)
    }

    res.json({
      psychologists: psychologistsCount,
      clients: clientsCount,
      dreams: dreamsCount,
      sessions: sessionsCount,
      topSymbolsToday
    });
  } catch (e: any) {
    console.error('Error fetching public stats:', e);
    res.status(500).json({ error: e.message || 'Failed to load statistics' });
  }
});

// Публичный профиль психолога + отзывы + слоты
router.get('/public/:id', async (req, res) => {
  try {
    await ensureMatchCatalogSchema();
    const psychologist = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'psychologist', isVerified: true, catalogHidden: false },
      select: { id: true, email: true }
    });
    if (!psychologist) return res.status(404).json({ error: 'Психолог не найден' });

    const profileRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Profile" WHERE "userId" = ? LIMIT 1`,
      psychologist.id
    );
    const profile = profileRows[0] || null;
    let educations: any[] = [];
    try {
      educations = await prisma.$queryRawUnsafe(
        `SELECT "id","kind","institution","title","yearFrom","yearTo" FROM "PsychologistEducation" WHERE "userId" = ? ORDER BY "yearFrom" DESC`,
        psychologist.id
      );
    } catch {
      educations = [];
    }

    const parseJsonField = (raw: unknown) => {
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    const prefs = mergeCalendarPrefs(parseJsonField(profile?.calendarPrefs));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const until = new Date(since);
    until.setDate(until.getDate() + 21);
    const events = await prisma.event.findMany({
      where: { createdBy: psychologist.id, startsAt: { gte: since, lte: until } },
      select: { startsAt: true, endsAt: true },
    });
    const freeSlots = listFreeSlots({ prefs, events, daysAhead: 14, limit: 48 });

    await ensurePsychologistReviewsTable();
    const reviews = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT pr."id", pr."rating", pr."comment", pr."createdAt", c."name" as "clientName"
      FROM "PsychologistReview" pr
      LEFT JOIN "Client" c ON c."id" = pr."clientId"
      WHERE pr."psychologistId" = ?
      ORDER BY pr."createdAt" DESC
      LIMIT 30
      `,
      psychologist.id
    );
    const avg = reviews.length
      ? Number((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length).toFixed(2))
      : 0;

    const enrichedProfile = profile
      ? {
          ...profile,
          worksWith: parseJsonField(profile.worksWith),
          audienceFormats: parseJsonField(profile.audienceFormats),
          specialization: parseJsonField(profile.specialization) ?? profile.specialization,
        }
      : null;
    const card = mapPublicCard(psychologist, enrichedProfile);
    res.json({
      psychologist: {
        ...card,
        educations: educations.map((e) => ({
          id: e.id,
          kind: e.kind,
          institution: e.institution,
          title: e.title,
          yearFrom: e.yearFrom,
          yearTo: e.yearTo,
        })),
        nearestSlot: freeSlots[0] || null,
        freeSlots,
        slotIntervalMinutes: prefs.slotIntervalMinutes,
      },
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: Number(r.rating || 0),
        comment: r.comment || '',
        createdAt: r.createdAt,
        clientName: r.clientName || 'Клиент'
      })),
      stats: { averageRating: avg, reviewsCount: reviews.length }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologist profile' });
  }
});

/** Запись со слота + анкета → запросы психолога + письмо клиенту */
router.post('/public/:id/book', async (req, res) => {
  try {
    await ensureMatchCatalogSchema();
    const psychologistId = req.params.id;
    const psychologist = await prisma.user.findFirst({
      where: { id: psychologistId, role: 'psychologist', isVerified: true, catalogHidden: false },
      include: { profile: { select: { name: true } } },
    });
    if (!psychologist) return res.status(404).json({ error: 'Психолог не найден' });

    const contactName = typeof req.body?.contactName === 'string' ? req.body.contactName.trim() : '';
    const contactEmail = typeof req.body?.contactEmail === 'string' ? req.body.contactEmail.trim() : '';
    const contactPhone = typeof req.body?.contactPhone === 'string' ? req.body.contactPhone.trim().slice(0, 40) : '';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    if (contactName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({ error: 'Укажите имя и корректный email' });
    }

    const slotStartRaw = req.body?.slotStart;
    const slotEndRaw = req.body?.slotEnd;
    const slotStart = slotStartRaw ? new Date(slotStartRaw) : null;
    const slotEnd = slotEndRaw ? new Date(slotEndRaw) : null;
    if (!slotStart || Number.isNaN(slotStart.getTime())) {
      return res.status(400).json({ error: 'Выберите свободный слот' });
    }
    if (slotStart.getTime() < Date.now() - 30_000) {
      return res.status(400).json({ error: 'Нельзя записаться на прошедшее время' });
    }

    const whoFor = ['self', 'couple', 'child'].includes(req.body?.whoFor) ? req.body.whoFor : 'self';
    const topics = Array.isArray(req.body?.topics) ? req.body.topics.map(String).slice(0, 12) : [];
    const customTopic = typeof req.body?.customTopic === 'string' ? req.body.customTopic.trim().slice(0, 200) : '';
    const priceBand = PRICE_BANDS.find((b) => b.id === req.body?.priceBand);
    const timePreference = req.body?.timePreference || 'slot';
    const slotLabel = slotStart.toLocaleString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    const questionnaire = {
      whoFor,
      topics,
      customTopic: customTopic || null,
      timePreference,
      priceBand: priceBand?.id || null,
      priceBandLabel: priceBand?.label || null,
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd && !Number.isNaN(slotEnd.getTime()) ? slotEnd.toISOString() : null,
      slotLabel,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      note: note || null,
    };

    const calendarBooking = await prisma.calendarPublicBookingRequest.create({
      data: {
        psychologistId,
        slotStart,
        slotEnd: slotEnd && !Number.isNaN(slotEnd.getTime()) ? slotEnd : null,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        message: formatQuestionnaireText(questionnaire),
        questionnaire: questionnaire as any,
        source: 'match',
        status: 'pending',
      } as any,
    });

    const psychName = psychologist.profile?.name || 'специалист';
    if (isEmailTransportConfigured()) {
      try {
        await sendEmail({
          to: contactEmail,
          subject: 'JungAI — заявка на сессию принята',
          text: [
            `Здравствуйте, ${contactName}!`,
            '',
            `Мы передали вашу заявку специалисту (${psychName}).`,
            `Желаемое время: ${slotLabel}.`,
            '',
            'Ключевые детали придут на эту почту после подтверждения психологом.',
            'Если нужно что-то уточнить — напишите на inbox@jung-ai.ru.',
            '',
            '— Команда JungAI',
          ].join('\n'),
          html: `<p>Здравствуйте, <strong>${contactName}</strong>!</p>
            <p>Мы передали вашу заявку специалисту (<strong>${psychName}</strong>).</p>
            <p>Желаемое время: <strong>${slotLabel}</strong>.</p>
            <p>Ключевые детали придут на эту почту после подтверждения психологом.</p>
            <p>Вопросы: <a href="mailto:inbox@jung-ai.ru">inbox@jung-ai.ru</a></p>`,
        });
      } catch (mailErr) {
        console.error('book confirmation email failed', mailErr);
      }
    }

    res.json({
      ok: true,
      bookingId: calendarBooking.id,
      message:
        'Заявка отправлена. Ключевая информация придёт на email после подтверждения психологом.',
      frontendUrl: config.frontendUrl,
    });
  } catch (e: any) {
    console.error('book match error', e);
    res.status(500).json({ error: e.message || 'Не удалось создать заявку' });
  }
});

// Клиент может оценить только своего прикрепленного психолога
router.post('/:id/rating', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const psychologistId = req.params.id;
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
    }

    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, psychologistId: true }
    });
    if (!client) return res.status(404).json({ error: 'Клиент не найден' });
    if (client.psychologistId !== psychologistId) {
      return res.status(403).json({ error: 'Оценка доступна только для вашего психолога' });
    }

    await ensurePsychologistReviewsTable();
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id" FROM "PsychologistReview" WHERE "psychologistId" = ? AND "clientId" = ? LIMIT 1`,
      psychologistId,
      client.id
    );

    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "PsychologistReview" SET "rating" = ?, "comment" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
        rating,
        comment || null,
        existing[0].id
      );
    } else {
      const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PsychologistReview" ("id", "psychologistId", "clientId", "rating", "comment") VALUES (?, ?, ?, ?, ?)`,
        id,
        psychologistId,
        client.id,
        rating,
        comment || null
      );
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save rating' });
  }
});

router.get('/:id/rating/my', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, psychologistId: true }
    });
    if (!client) return res.json({ canRate: false, myRating: null });
    await ensurePsychologistReviewsTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "rating", "comment" FROM "PsychologistReview" WHERE "psychologistId" = ? AND "clientId" = ? LIMIT 1`,
      req.params.id,
      client.id
    );
    res.json({
      canRate: client.psychologistId === req.params.id,
      myRating: rows[0] ? { rating: Number(rows[0].rating || 0), comment: rows[0].comment || '' } : null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load my rating' });
  }
});

export default router;

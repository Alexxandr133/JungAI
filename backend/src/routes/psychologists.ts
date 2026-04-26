import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

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

// Публичный список психологов (для гостей)
router.get('/public', async (req, res) => {
  try {
    const psychologists = await prisma.user.findMany({
      where: {
        role: 'psychologist',
        isVerified: true // Только верифицированные психологи
      },
      select: {
        id: true,
        email: true
      }
    });

    const psychologistIds = psychologists.map(p => p.id);
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: psychologistIds }
      },
      select: {
        userId: true,
        name: true,
        bio: true,
        specialization: true,
        experience: true,
        avatarUrl: true
      }
    });

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const result = psychologists.map(psych => {
      const profile = profileMap.get(psych.id);
      return {
        id: psych.id,
        name: profile?.name || psych.email.split('@')[0],
        email: psych.email,
        bio: profile?.bio || null,
        specialization: profile?.specialization 
          ? (typeof profile.specialization === 'string' 
              ? [profile.specialization] 
              : Array.isArray(profile.specialization) 
                ? profile.specialization 
                : [])
          : [],
        experience: profile?.experience ? parseInt(String(profile.experience)) || 0 : 0,
        avatarUrl: profile?.avatarUrl ? (profile.avatarUrl.startsWith('http') ? profile.avatarUrl : profile.avatarUrl) : null,
        verified: true
      };
    });

    res.json({ psychologists: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists' });
  }
});

// Публичный профиль психолога + отзывы (без персональных данных)
router.get('/public/:id', async (req, res) => {
  try {
    const psychologist = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'psychologist', isVerified: true },
      select: { id: true, email: true }
    });
    if (!psychologist) return res.status(404).json({ error: 'Психолог не найден' });

    const profile = await prisma.profile.findUnique({
      where: { userId: psychologist.id },
      select: { name: true, bio: true, specialization: true, experience: true, avatarUrl: true }
    });

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

    res.json({
      psychologist: {
        id: psychologist.id,
        name: profile?.name || psychologist.email.split('@')[0],
        bio: profile?.bio || null,
        specialization: profile?.specialization
          ? (typeof profile.specialization === 'string' ? [profile.specialization] : Array.isArray(profile.specialization) ? profile.specialization : [])
          : [],
        experience: profile?.experience ? parseInt(String(profile.experience)) || 0 : 0,
        avatarUrl: profile?.avatarUrl || null,
        verified: true
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

// Публичная статистика для главной страницы
router.get('/public/stats', async (req, res) => {
  try {
    // Количество психологов (верифицированных)
    const psychologistsCount = await prisma.user.count({
      where: {
        role: 'psychologist',
        isVerified: true
      }
    });

    // Количество клиентов
    const clientsCount = await prisma.client.count();

    // Общее количество снов
    const dreamsCount = await prisma.dream.count();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const publishAfter = new Date(dayStart);
    publishAfter.setHours(SYMBOLS_PUBLISH_HOUR, 0, 0, 0);
    const now = new Date();
    const dayIso = dayStart.toISOString();

    // Главная: до 18:00 не показываем «сегодняшнюю» отбивку (ни сырой расчёт, ни раннюю валидацию).
    // Только последняя завершённая запись за прошлые сутки, иначе пусто → на фронте демо.
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
      topSymbolsToday
    });
  } catch (e: any) {
    console.error('Error fetching public stats:', e);
    res.status(500).json({ error: e.message || 'Failed to load statistics' });
  }
});

export default router;

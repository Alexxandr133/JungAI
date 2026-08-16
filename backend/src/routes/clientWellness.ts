import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { isEmailTransportConfigured, sendEmail } from '../utils/email';

const router = Router();

function localDateKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let wellnessSchemaReady: Promise<void> | null = null;

async function ensureClientWellnessSchema() {
  if (!wellnessSchemaReady) {
    wellnessSchemaReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MoodCheckIn" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clientId" TEXT NOT NULL,
          "mood" INTEGER NOT NULL,
          "energy" INTEGER NOT NULL,
          "anxiety" INTEGER NOT NULL,
          "note" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "MoodCheckIn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "MoodCheckIn_clientId_createdAt_idx" ON "MoodCheckIn"("clientId", "createdAt");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClientMatchProfile" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clientId" TEXT NOT NULL,
          "topics" JSONB NOT NULL,
          "format" TEXT NOT NULL DEFAULT 'individual',
          "timePreference" TEXT,
          "methodNotes" TEXT,
          "updatedAt" DATETIME NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ClientMatchProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ClientMatchProfile_clientId_key" ON "ClientMatchProfile"("clientId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClientPractice" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "slug" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "durationMin" INTEGER NOT NULL,
          "kind" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ClientPractice_slug_key" ON "ClientPractice"("slug");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ClientPracticeCompletion" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clientId" TEXT NOT NULL,
          "practiceId" TEXT NOT NULL,
          "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ClientPracticeCompletion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "ClientPracticeCompletion_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "ClientPractice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ClientPracticeCompletion_clientId_completedAt_idx" ON "ClientPracticeCompletion"("clientId", "completedAt");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CertificateRequest" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clientId" TEXT,
          "email" TEXT NOT NULL,
          "message" TEXT,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CertificateRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SessionReflection" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "clientId" TEXT NOT NULL,
          "eventId" TEXT,
          "sessionId" TEXT,
          "moodAfter" INTEGER NOT NULL,
          "text" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SessionReflection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SessionReflection_clientId_createdAt_idx" ON "SessionReflection"("clientId", "createdAt");
      `);
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Dream" ADD COLUMN "discussOnSession" BOOLEAN NOT NULL DEFAULT false`
        );
      } catch {
        /* column may already exist */
      }
    })().catch((err) => {
      wellnessSchemaReady = null;
      throw err;
    });
  }
  await wellnessSchemaReady;
}

async function resolveClient(email: string) {
  return prisma.client.findFirst({
    where: { email },
    select: { id: true, name: true, email: true, psychologistId: true },
  });
}

function clampScore(n: number, min = 1, max = 5) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

// ── Mood ───────────────────────────────────────────────
router.get('/client/mood', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const items = await prisma.moodCheckIn.findMany({
      where: { clientId: client.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, { mood: number; energy: number; anxiety: number; createdAt: Date }>();
    for (const item of items) {
      const key = localDateKey(item.createdAt);
      // одна отметка на день — берём последнюю на случай старых дублей
      byDay.set(key, {
        mood: item.mood,
        energy: item.energy,
        anxiety: item.anxiety,
        createdAt: item.createdAt,
      });
    }

    const daily: Array<{ date: string; mood: number | null; energy: number | null; anxiety: number | null }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = localDateKey(d);
      const row = byDay.get(key);
      daily.push({
        date: key,
        mood: row?.mood ?? null,
        energy: row?.energy ?? null,
        anxiety: row?.anxiety ?? null,
      });
    }

    const todayKey = localDateKey();
    const todayRow = byDay.get(todayKey);
    const today = todayRow
      ? {
          mood: todayRow.mood,
          energy: todayRow.energy,
          anxiety: todayRow.anxiety,
          createdAt: todayRow.createdAt,
        }
      : null;

    res.json({ items, daily, today, lockedToday: Boolean(today) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load mood' });
  }
});

router.post('/client/mood', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const existing = await prisma.moodCheckIn.findFirst({
      where: { clientId: client.id, createdAt: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Настроение уже отмечено сегодня. Следующая отметка — завтра.',
        code: 'MOOD_ALREADY_TODAY',
        item: existing,
      });
    }

    const mood = clampScore(req.body?.mood);
    const energy = clampScore(req.body?.energy ?? 3);
    const anxiety = clampScore(req.body?.anxiety ?? 3);
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null;
    const item = await prisma.moodCheckIn.create({
      data: { clientId: client.id, mood, energy, anxiety, note },
    });
    res.json({ item, lockedToday: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save mood' });
  }
});

// ── Practices ──────────────────────────────────────────
router.get('/client/practices', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    // Практики в разработке — каталог пока не отдаём клиенту
    res.json({ practices: [], weekCompletions: 0, underDevelopment: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load practices' });
  }
});

router.post('/client/practices/:id/complete', requireAuth, requireRole(['client', 'admin']), async (_req: AuthedRequest, res) => {
  res.status(503).json({ error: 'Практики пока в разработке', underDevelopment: true });
});

// ── Match profile ──────────────────────────────────────
router.get('/client/match-profile', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    const profile = await prisma.clientMatchProfile.findUnique({ where: { clientId: client.id } });
    res.json({ profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load match profile' });
  }
});

router.put('/client/match-profile', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    const topics = Array.isArray(req.body?.topics) ? req.body.topics.map(String).slice(0, 12) : [];
    const format = req.body?.format === 'couple' ? 'couple' : 'individual';
    const timePreference = ['morning', 'day', 'evening', 'flexible'].includes(req.body?.timePreference)
      ? req.body.timePreference
      : 'flexible';
    const methodNotes = typeof req.body?.methodNotes === 'string' ? req.body.methodNotes.slice(0, 400) : null;
    const profile = await prisma.clientMatchProfile.upsert({
      where: { clientId: client.id },
      create: { clientId: client.id, topics, format, timePreference, methodNotes },
      update: { topics, format, timePreference, methodNotes },
    });
    res.json({ profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save match profile' });
  }
});

router.post('/client/match', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });

    const { parseMatchBody, runPsychologistMatch } = await import('../utils/matchEngine');
    const query = parseMatchBody(req.body || {});

    await prisma.clientMatchProfile.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        topics: query.topics,
        format: query.whoFor === 'couple' ? 'couple' : query.whoFor === 'child' ? 'child' : 'self',
        timePreference: query.timePreference,
        methodNotes: query.methodNotes || null,
      },
      update: {
        topics: query.topics,
        format: query.whoFor === 'couple' ? 'couple' : query.whoFor === 'child' ? 'child' : 'self',
        timePreference: query.timePreference,
        methodNotes: query.methodNotes || null,
      },
    });
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "ClientMatchProfile" SET "whoFor" = ?, "customTopic" = ?, "priceMin" = ?, "priceMax" = ?, "preferredSlotStart" = ?, "preferredSlotEnd" = ? WHERE "clientId" = ?`,
        query.whoFor,
        query.customTopic || null,
        query.priceMin ?? null,
        query.priceMax ?? null,
        query.preferredSlotStart || null,
        query.preferredSlotEnd || null,
        client.id
      );
    } catch {
      /* extended columns may appear after ensure */
    }

    const { matches, total } = await runPsychologistMatch(query);
    res.json({ matches, total, query });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to match' });
  }
});

// ── Progress ───────────────────────────────────────────
router.get('/client/progress', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });

    const since30 = new Date(Date.now() - 30 * 86400000);
    const [sessions, events, moodItems, flaggedDreams, homeworkSessions, reflections, journalCount, dreamCount] =
      await Promise.all([
        prisma.therapySession.findMany({
          where: { clientId: client.id },
          orderBy: { date: 'desc' },
          take: 20,
          select: { id: true, date: true, summary: true, homework: true, moodBefore: true, moodAfter: true },
        }),
        prisma.event.findMany({
          where: { clientId: client.id },
          orderBy: { startsAt: 'desc' },
          take: 20,
          select: { id: true, title: true, startsAt: true, endsAt: true, sessionStatus: true, type: true },
        }),
        prisma.moodCheckIn.findMany({
          where: { clientId: client.id, createdAt: { gte: since30 } },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.dream.findMany({
          where: { clientId: client.id, discussOnSession: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, title: true, createdAt: true },
        }),
        prisma.therapySession.findMany({
          where: { clientId: client.id, homework: { not: null } },
          orderBy: { date: 'desc' },
          take: 10,
          select: { id: true, date: true, homework: true },
        }),
        prisma.sessionReflection.findMany({
          where: { clientId: client.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.journalEntry.count({ where: { clientId: client.id } }),
        prisma.dream.count({ where: { clientId: client.id } }),
      ]);

    const openHomework = homeworkSessions
      .filter((s) => s.homework && String(s.homework).trim())
      .map((s) => ({ id: s.id, date: s.date, homework: s.homework }));

    const moodAvg =
      moodItems.length > 0
        ? Math.round((moodItems.reduce((a, b) => a + b.mood, 0) / moodItems.length) * 10) / 10
        : null;

    res.json({
      sessionCount: sessions.length,
      eventCount: events.length,
      journalCount,
      dreamCount,
      moodAvg30d: moodAvg,
      moodTrend: moodItems.map((m) => ({
        date: m.createdAt,
        mood: m.mood,
        energy: m.energy,
        anxiety: m.anxiety,
      })),
      recentSessions: sessions,
      recentEvents: events,
      flaggedDreams,
      openHomework,
      reflections,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load progress' });
  }
});

router.get('/client/homework', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    const items = await prisma.therapySession.findMany({
      where: { clientId: client.id, NOT: { homework: null } },
      orderBy: { date: 'desc' },
      take: 20,
      select: { id: true, date: true, homework: true, nextFocus: true },
    });
    res.json({
      items: items.filter((i) => i.homework && String(i.homework).trim()),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load homework' });
  }
});

router.post('/client/session-reflection', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    const moodAfter = clampScore(req.body?.moodAfter);
    const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 2000) : null;
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;

    const item = await prisma.sessionReflection.create({
      data: { clientId: client.id, moodAfter, text, eventId, sessionId },
    });

    if (sessionId) {
      await prisma.therapySession.updateMany({
        where: { id: sessionId, clientId: client.id },
        data: { moodAfter: String(moodAfter) },
      });
    }

    res.json({ item });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save reflection' });
  }
});

router.post('/client/certificate-request', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    const email = String(req.body?.email || client?.email || req.user!.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Укажите корректный email' });
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 1000) : null;
    const item = await prisma.certificateRequest.create({
      data: { clientId: client?.id || null, email, message },
    });

    const to = String(config.supportEmail || '').trim();
    if (to && isEmailTransportConfigured()) {
      const safeMessage = (message || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await sendEmail({
        to,
        subject: 'JungAI — заявка на подарочный сертификат',
        html: `
          <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
            <h2 style="margin:0 0 12px">Подарочный сертификат</h2>
            <p><b>Email заявителя:</b> ${email.replace(/</g, '&lt;')}</p>
            <p><b>Клиент:</b> ${client?.name || '—'} (${client?.id || 'нет профиля'})</p>
            <p><b>Аккаунт:</b> ${req.user!.email}</p>
            <p><b>Сообщение:</b></p>
            <pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${safeMessage}</pre>
            <p style="color:#666;font-size:13px">ID заявки: ${item.id}</p>
          </div>
        `,
      }).catch((err) => {
        console.error('[certificate-request] email failed', err);
      });
    } else {
      console.warn('[certificate-request] SMTP/support email not configured; request saved only');
    }

    res.json({ item, ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to submit certificate request' });
  }
});

router.get('/client/onboarding', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureClientWellnessSchema();
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });

    const [profile, dreamCount, matchProfile, eventCount, moodToday] = await Promise.all([
      prisma.profile.findFirst({ where: { userId: req.user!.id } }),
      prisma.dream.count({ where: { clientId: client.id } }),
      prisma.clientMatchProfile.findUnique({ where: { clientId: client.id } }),
      prisma.event.count({ where: { clientId: client.id } }),
      prisma.moodCheckIn.findFirst({
        where: {
          clientId: client.id,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const hasPsych =
      Boolean(client.psychologistId) && !String(client.psychologistId).startsWith('temp-');

    const steps = [
      {
        id: 'profile',
        title: 'Заполните профиль',
        done: Boolean(profile?.name),
        path: '/client/profile',
      },
      {
        id: 'explore',
        title: 'Запишите сон',
        done: dreamCount > 0,
        path: '/dreams?new=1',
      },
      {
        id: 'match',
        title: 'Подберите психолога',
        done: Boolean(matchProfile) || hasPsych,
        path: '/client/match',
      },
      {
        id: 'session',
        title: 'Запишитесь на сессию',
        done: eventCount > 0,
        path: '/client/sessions',
      },
      {
        id: 'mood',
        title: 'Отметьте состояние сегодня',
        done: Boolean(moodToday),
        path: '/client/care',
      },
    ];

    const doneCount = steps.filter((s) => s.done).length;
    res.json({ steps, doneCount, total: steps.length, complete: doneCount === steps.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load onboarding' });
  }
});

router.post('/client/session-reminders/sync', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await resolveClient(req.user!.email);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });

    const now = new Date();
    const in24h = new Date(Date.now() + 24 * 3600000);
    const upcoming = await prisma.event.findMany({
      where: {
        clientId: client.id,
        startsAt: { gte: now, lte: in24h },
        OR: [{ sessionStatus: null }, { sessionStatus: { not: 'declined' } }],
      },
      select: { id: true, title: true, startsAt: true },
    });

    const created: string[] = [];
    for (const ev of upcoming) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: req.user!.id,
          type: 'session_reminder',
          entityId: ev.id,
          createdAt: { gte: new Date(Date.now() - 48 * 3600000) },
        },
      });
      if (existing) continue;
      const when = new Date(ev.startsAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'session_reminder',
          title: 'Скоро сессия',
          message: `«${ev.title}» — ${when}`,
          entityType: 'event',
          entityId: ev.id,
        },
      });
      created.push(ev.id);
    }

    res.json({
      upcoming: upcoming.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
      })),
      remindersCreated: created.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to sync reminders' });
  }
});

export default router;

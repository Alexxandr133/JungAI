import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { ensurePageAnalyticsTables, featureMeta } from '../utils/pageAnalytics';
import { acceptingClientsByIds } from '../utils/acceptingClients';
import { runDailyDreamSymbolValidation } from '../jobs/dailyDreamSymbols';
import { processPendingDreamSymbolsBatch, migrateDreamSymbolsToAi } from '../jobs/dreamSymbolExtraction';

const router = Router();

// Все маршруты требуют авторизации и роли admin
router.use(requireAuth);
router.use((req: AuthedRequest, res, next) => requireRole(['admin'])(req, res, next));

// Получить все запросы на верификацию
router.get('/verification', async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.verificationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    // Получаем профили для всех пользователей
    const userIds = requests.map(r => r.userId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, name: true, avatarUrl: true, phone: true, location: true, specialization: true, experience: true, bio: true }
    });
    
    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    
    const formatted = requests.map(r => {
      const profile = profileMap.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        userName: profile?.name || null,
        userEmail: r.user.email,
        avatarUrl: profile?.avatarUrl || null,
        phone: profile?.phone || null,
        location: profile?.location || null,
        specialization: profile?.specialization || null,
        experience: profile?.experience || null,
        bio: profile?.bio || null,
        documentPath: r.documentPath,
        fileName: r.fileName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() || null,
        comment: r.comment || null
      };
    });
    
    res.json({ requests: formatted });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load verification requests' });
  }
});

// Получить документ верификации
router.get('/verification/:id/document', async (req: AuthedRequest, res) => {
  try {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const filePath = request.documentPath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load document' });
  }
});

// Рассмотреть запрос на верификацию
router.post('/verification/:id/review', async (req: AuthedRequest, res) => {
  try {
    const { status, comment } = req.body ?? {};
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Комментарий обязателен при отклонении
    if (status === 'rejected' && (!comment || !comment.trim())) {
      return res.status(400).json({ error: 'Комментарий обязателен при отклонении запроса' });
    }
    
    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Обновляем запрос
    await prisma.verificationRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        comment: comment ? comment.trim() : null
      }
    });
    
    // Если одобрено, обновляем статус пользователя
    if (status === 'approved') {
      await prisma.user.update({
        where: { id: request.userId },
        data: { isVerified: true }
      });
    } else {
      // Если отклонено, сбрасываем статус
      await prisma.user.update({
        where: { id: request.userId },
        data: { isVerified: false }
      });
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to review request' });
  }
});

// Статистика для дашборда админа
router.get('/dashboard', async (req: AuthedRequest, res) => {
  try {
    // Статистика по техподдержке
    const allSupportRequests = await prisma.supportRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const supportStats = {
      total: allSupportRequests.length,
      open: allSupportRequests.filter(r => r.status === 'open').length,
      inProgress: allSupportRequests.filter(r => r.status === 'in_progress').length,
      resolved: allSupportRequests.filter(r => r.status === 'resolved').length,
      closed: allSupportRequests.filter(r => r.status === 'closed').length,
      withWorkAreaAccess: allSupportRequests.filter(r => r.allowWorkAreaAccess && ['open', 'in_progress'].includes(r.status)).length
    };

    // Статистика по верификации
    const verificationRequests = await prisma.verificationRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const verificationStats = {
      total: verificationRequests.length,
      pending: verificationRequests.filter(r => r.status === 'pending').length,
      approved: verificationRequests.filter(r => r.status === 'approved').length,
      rejected: verificationRequests.filter(r => r.status === 'rejected').length
    };

    // Общая статистика системы
    const now = new Date();
    const withVoiceRoom = { voiceRoom: { isNot: null } } as const;

    const [
      totalUsers,
      totalPsychologists,
      totalClients,
      totalDreams,
      totalSessions,
      videoMeetingsUpcoming,
      videoMeetingsInSlot,
      videoMeetingsPast,
      voiceRoomsTotal
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'psychologist' } }),
      prisma.client.count(),
      prisma.dream.count(),
      prisma.therapySession.count(),
      prisma.event.count({
        where: { ...withVoiceRoom, startsAt: { gt: now } }
      }),
      prisma.event.count({
        where: {
          ...withVoiceRoom,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }]
        }
      }),
      prisma.event.count({
        where: {
          ...withVoiceRoom,
          endsAt: { not: null, lt: now }
        }
      }),
      prisma.voiceRoom.count()
    ]);

    const systemStats = {
      totalUsers,
      totalPsychologists,
      totalClients,
      totalDreams,
      totalSessions,
      videoMeetingsUpcoming,
      videoMeetingsInSlot,
      videoMeetingsPast,
      voiceRoomsTotal
    };

    // Последние запросы в техподдержку
    const recentSupportRequests = allSupportRequests.slice(0, 5).map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
      psychologistId: r.psychologistId
    }));

    // Получаем информацию о психологах для последних запросов
    const psychologistIds = [...new Set(recentSupportRequests.map(r => r.psychologistId))];
    const psychologists = await prisma.user.findMany({
      where: { id: { in: psychologistIds } },
      select: { id: true, email: true }
    });
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: psychologistIds } },
      select: { userId: true, name: true }
    });

    const psychMap = new Map(psychologists.map(p => [p.id, p]));
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const recentWithNames = recentSupportRequests.map(r => {
      const psych = psychMap.get(r.psychologistId);
      const profile = profileMap.get(r.psychologistId);
      return {
        ...r,
        psychologistEmail: psych?.email || null,
        psychologistName: profile?.name || null
      };
    });

    res.json({
      support: supportStats,
      verification: verificationStats,
      system: systemStats,
      recentSupportRequests: recentWithNames
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось загрузить статистику' });
  }
});

// Каталог психологов на сайте: порядок и скрытие
router.get('/psychologists-catalog', async (_req: AuthedRequest, res) => {
  try {
    const psychologists = await prisma.user.findMany({
      where: { role: 'psychologist' },
      select: {
        id: true,
        email: true,
        isVerified: true,
        catalogSortOrder: true,
        catalogHidden: true,
        createdAt: true
      },
      orderBy: [{ catalogSortOrder: 'asc' }, { createdAt: 'asc' }]
    });
    const ids = psychologists.map(p => p.id);
    const searchMap = await acceptingClientsByIds(ids);

    const parseJson = (raw: unknown): unknown => {
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };
    const asStringArray = (raw: unknown): string[] => {
      const v = parseJson(raw);
      if (Array.isArray(v)) return v.map(String).filter(Boolean);
      if (typeof v === 'string' && v.trim()) {
        return v.split(/[,;|/]/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    let profiles: any[] = [];
    if (ids.length) {
      try {
        const placeholders = ids.map(() => '?').join(',');
        profiles = await prisma.$queryRawUnsafe(
          `SELECT * FROM "Profile" WHERE "userId" IN (${placeholders})`,
          ...ids
        );
      } catch {
        profiles = await prisma.profile.findMany({ where: { userId: { in: ids } } });
      }
    }
    const profileMap = new Map(profiles.map((p: any) => [p.userId, p]));

    let reviewStats = new Map<string, { avg: number; count: number }>();
    try {
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
      /* reviews optional */
    }

    res.json({
      items: psychologists.map((p, index) => {
        const profile = profileMap.get(p.id);
        const accepting = searchMap.get(p.id) !== false;
        const stats = reviewStats.get(p.id);
        const specialization = asStringArray(profile?.specialization);
        return {
          id: p.id,
          email: p.email,
          name: profile?.name || p.email.split('@')[0],
          avatarUrl: profile?.avatarUrl || null,
          bio: profile?.bio || null,
          therapyMethod: profile?.therapyMethod || null,
          specialization,
          worksWith: asStringArray(profile?.worksWith),
          experience: profile?.experience ? parseInt(String(profile.experience), 10) || 0 : 0,
          sessionPriceRub: profile?.sessionPriceRub ?? null,
          rating: stats && stats.count >= 1 ? Number(stats.avg.toFixed(1)) : null,
          reviewsCount: stats?.count ?? 0,
          isVerified: p.isVerified,
          sortOrder: p.catalogSortOrder ?? index,
          hidden: Boolean(p.catalogHidden),
          acceptingClients: accepting,
          visibleOnSite: p.isVerified && !p.catalogHidden && accepting
        };
      })
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists catalog' });
  }
});

router.put('/psychologists-catalog', async (req: AuthedRequest, res) => {
  try {
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const ids = items.map((it: any) => String(it.id || '')).filter(Boolean);
    const psychologists = await prisma.user.findMany({
      where: { id: { in: ids }, role: 'psychologist' },
      select: { id: true }
    });
    const allowed = new Set(psychologists.map(p => p.id));
    if (allowed.size !== ids.length) {
      return res.status(400).json({ error: 'Invalid psychologist ids in items' });
    }
    await prisma.$transaction(
      items.map((it: any, index: number) =>
        prisma.user.update({
          where: { id: String(it.id) },
          data: {
            catalogSortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : index,
            catalogHidden: Boolean(it.hidden)
          }
        })
      )
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save psychologists catalog' });
  }
});

// Запустить "валидацию символов" вручную (раньше 18:00)
router.post('/dreams/validate-symbols', async (_req: AuthedRequest, res) => {
  try {
    const result = await runDailyDreamSymbolValidation();
    res.json({
      success: true,
      day: result.day,
      sourceDreams: result.sourceDreams,
      cleanedFrequency: result.cleanedFrequency
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to validate dream symbols' });
  }
});

router.post('/dreams/extract-symbols-ai', async (_req: AuthedRequest, res) => {
  try {
    const migrated = await migrateDreamSymbolsToAi();
    const processed = await processPendingDreamSymbolsBatch(25);
    res.json({ success: true, message: 'Сны поставлены в очередь на извлечение символов через ИИ', migrated, processedNow: processed });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to queue dream symbol extraction' });
  }
});

router.get('/analytics', async (req: AuthedRequest, res) => {
  try {
    const daysRaw = Number(req.query.days);
    const days = [7, 30, 90].includes(daysRaw) ? daysRaw : 30;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const seriesDays: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(to.getTime() - i * 24 * 60 * 60 * 1000);
      seriesDays.push(dayKey(d));
    }
    const emptySeries = () => Object.fromEntries(seriesDays.map((k) => [k, 0])) as Record<string, number>;

    const [
      usersInRange,
      usersByRole,
      psychologistsVerified,
      psychologistsUnverified,
      clientsAll,
      sessionsInRange,
      openTasks,
      pendingVerifications,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { createdAt: true, role: true },
      }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count({ where: { role: 'psychologist', isVerified: true } }),
      prisma.user.count({ where: { role: 'psychologist', isVerified: false } }),
      prisma.client.findMany({
        select: {
          therapyEndedAt: true,
          registrationToken: true,
          tokenExpiresAt: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.therapySession.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true },
      }),
      prisma.task.count({ where: { status: { not: 'done' }, clientId: { not: null } } }),
      prisma.verificationRequest.count({ where: { status: 'pending' } }),
    ]);

    const registrationsByDay = emptySeries();
    for (const u of usersInRange) {
      const k = dayKey(u.createdAt);
      if (k in registrationsByDay) registrationsByDay[k] += 1;
    }

    const sessionsByDay = emptySeries();
    for (const s of sessionsInRange) {
      const k = dayKey(s.date);
      if (k in sessionsByDay) sessionsByDay[k] += 1;
    }

    const now = Date.now();
    let clientsActive = 0;
    let clientsArchive = 0;
    let inviteRegistered = 0;
    let invitePending = 0;
    let inviteExpired = 0;

    const clientEmails = clientsAll.map((c) => c.email).filter(Boolean) as string[];
    const platformUsers = clientEmails.length
      ? await prisma.user.findMany({
          where: { email: { in: clientEmails } },
          select: { email: true },
        })
      : [];
    const platformEmailSet = new Set(platformUsers.map((u) => String(u.email).toLowerCase()));

    for (const c of clientsAll) {
      if (c.therapyEndedAt) {
        clientsArchive += 1;
        continue;
      }
      clientsActive += 1;
      const email = c.email ? String(c.email).toLowerCase() : '';
      const onPlatform = email && platformEmailSet.has(email);
      if (onPlatform) {
        inviteRegistered += 1;
      } else if (c.registrationToken) {
        const exp = c.tokenExpiresAt ? c.tokenExpiresAt.getTime() : NaN;
        if (Number.isFinite(exp) && exp < now) inviteExpired += 1;
        else invitePending += 1;
      } else {
        inviteRegistered += 1;
      }
    }

    res.json({
      range: { from: from.toISOString(), to: to.toISOString(), days },
      summary: {
        totalUsers: usersByRole.reduce((a, r) => a + r._count._all, 0),
        usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])),
        psychologistsVerified,
        psychologistsUnverified,
        pendingVerifications,
        clientsActive,
        clientsArchive,
        inviteRegistered,
        invitePending,
        inviteExpired,
        openTasks,
        sessionsInRange: sessionsInRange.length,
        registrationsInRange: usersInRange.length,
      },
      series: {
        days: seriesDays,
        registrations: seriesDays.map((d) => registrationsByDay[d] || 0),
        sessions: seriesDays.map((d) => sessionsByDay[d] || 0),
      },
      product: await buildProductUsage(from),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load analytics' });
  }
});

async function buildProductUsage(from: Date) {
  try {
    await ensurePageAnalyticsTables();
    const visits = (await (prisma as any).$queryRawUnsafe(
      `SELECT pathKey, durationMs, userId FROM "UserPageVisit"
       WHERE startedAt >= ? LIMIT 20000`,
      from.toISOString()
    )) as Array<{ pathKey: string; durationMs: number; userId: string }>;
    const byKey = new Map<
      string,
      { pathKey: string; visits: number; durationMs: number; users: Set<string> }
    >();
    for (const v of visits || []) {
      const key = String(v.pathKey || '/');
      const cur = byKey.get(key) || { pathKey: key, visits: 0, durationMs: 0, users: new Set<string>() };
      cur.visits += 1;
      cur.durationMs += Number(v.durationMs) || 0;
      cur.users.add(String(v.userId));
      byKey.set(key, cur);
    }
    const features = Array.from(byKey.values())
      .map((row) => {
        const meta = featureMeta(row.pathKey);
        return {
          pathKey: row.pathKey,
          label: meta.label,
          area: meta.area,
          visits: row.visits,
          uniqueUsers: row.users.size,
          durationMs: row.durationMs,
          avgDurationMs: row.visits ? Math.round(row.durationMs / row.visits) : 0,
        };
      })
      .sort((a, b) => b.durationMs - a.durationMs || b.visits - a.visits)
      .slice(0, 50);

    const byArea = new Map<string, { area: string; visits: number; durationMs: number; uniqueUsers: Set<string> }>();
    for (const f of features) {
      const cur = byArea.get(f.area) || {
        area: f.area,
        visits: 0,
        durationMs: 0,
        uniqueUsers: new Set<string>(),
      };
      cur.visits += f.visits;
      cur.durationMs += f.durationMs;
      byArea.set(f.area, cur);
    }

    // rebuild unique users per area from raw visits
    for (const v of visits || []) {
      const meta = featureMeta(String(v.pathKey || '/'));
      const cur = byArea.get(meta.area);
      if (cur) cur.uniqueUsers.add(String(v.userId));
    }

    return {
      totalVisits: visits.length,
      totalDurationMs: features.reduce((a, f) => a + f.durationMs, 0),
      features,
      areas: Array.from(byArea.values())
        .map((a) => ({
          area: a.area,
          visits: a.visits,
          durationMs: a.durationMs,
          uniqueUsers: a.uniqueUsers.size,
        }))
        .sort((a, b) => b.durationMs - a.durationMs),
    };
  } catch (e) {
    console.warn('[admin analytics] product usage:', (e as Error)?.message || e);
    return { totalVisits: 0, totalDurationMs: 0, features: [], areas: [] };
  }
}

export default router;


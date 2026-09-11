import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import {
  cuidLike,
  ensurePageAnalyticsTables,
  featureMeta,
  normalizePathKey,
} from '../utils/pageAnalytics';

const router = Router();

/** Heartbeat визита страницы (длительность на маршруте) */
router.post('/analytics/page-visit', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await ensurePageAnalyticsTables();
    const pathRaw = String(req.body?.path || '').trim().slice(0, 300);
    const durationMs = Math.max(0, Math.min(30 * 60 * 1000, Number(req.body?.durationMs) || 0));
    const visitIdRaw = typeof req.body?.visitId === 'string' ? req.body.visitId.trim().slice(0, 64) : '';
    const visitId = visitIdRaw || cuidLike();
    const nowIso = new Date().toISOString();

    await (prisma as any).$executeRawUnsafe(
      `UPDATE "User" SET "lastSeenAt" = ? WHERE id = ?`,
      nowIso,
      req.user!.id
    );

    if (!pathRaw || durationMs < 1000) {
      return res.json({ ok: true, skipped: true });
    }

    const pathKey = normalizePathKey(pathRaw);
    const startedAt = new Date(Date.now() - durationMs).toISOString();

    const existing = (await (prisma as any).$queryRawUnsafe(
      `SELECT id, durationMs, userId FROM "UserPageVisit" WHERE id = ? LIMIT 1`,
      visitId
    )) as Array<{ id: string; durationMs: number; userId: string }>;

    if (existing?.[0]?.userId === req.user!.id) {
      const nextDur = Math.max(Number(existing[0].durationMs) || 0, durationMs);
      await (prisma as any).$executeRawUnsafe(
        `UPDATE "UserPageVisit" SET durationMs = ?, endedAt = ?, path = ?, pathKey = ? WHERE id = ?`,
        nextDur,
        nowIso,
        pathRaw,
        pathKey,
        visitId
      );
    } else {
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO "UserPageVisit"(id, userId, path, pathKey, durationMs, startedAt, endedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        visitId,
        req.user!.id,
        pathRaw,
        pathKey,
        durationMs,
        startedAt,
        nowIso,
        nowIso
      );
    }

    res.json({ ok: true, pathKey, feature: featureMeta(pathKey), visitId });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to record page visit' });
  }
});

// Дашборд психолога
router.get('/analytics/dashboard', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const clients = await (prisma as any).client.findMany({
      where: { psychologistId: req.user!.id },
      select: { id: true, name: true, email: true, createdAt: true, therapyEndedAt: true }
    });

    const clientIds = clients.map((c: any) => c.id);
    const activeClientIds = clients.filter((c: any) => !c.therapyEndedAt).map((c: any) => c.id);

    // Общая статистика
    const totalClients = clients.length;
    const activeClients = activeClientIds.length;
    
    // Активные сессии (будущие)
    const now = new Date();
    const activeSessions = await (prisma as any).event.findMany({
      where: {
        createdBy: req.user!.id,
        type: 'session',
        startsAt: { gte: now },
        clientId: { in: clientIds },
        OR: [{ sessionStatus: null }, { sessionStatus: { not: 'declined' } }]
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        clientId: true,
        type: true,
        sessionStatus: true,
        voiceRoom: { select: { roomId: true, roomUrl: true } }
      },
      orderBy: { startsAt: 'asc' }
    });

    const nextEvent = activeSessions[0] ?? null;
    const nextClient = nextEvent?.clientId
      ? clients.find((c: any) => c.id === nextEvent.clientId)
      : null;
    const nextSession = nextEvent
      ? {
          id: nextEvent.id,
          title: nextEvent.title,
          startsAt: nextEvent.startsAt,
          clientId: nextEvent.clientId,
          clientName: nextClient?.name ?? null,
          type: nextEvent.type,
          sessionStatus: nextEvent.sessionStatus ?? null,
          roomUrl: nextEvent.voiceRoom?.roomUrl ?? null,
          roomId: nextEvent.voiceRoom?.roomId ?? null
        }
      : null;

    const pendingBookingRequests = await (prisma as any).calendarPublicBookingRequest.count({
      where: { psychologistId: req.user!.id, status: 'pending' }
    });
    const pendingSupportMatch = await prisma.supportRequest.count({
      where: {
        psychologistId: req.user!.id,
        clientId: { not: null },
        status: 'open'
      }
    });
    // Грубая сумма: календарные + support (дубли по email возможны редко; UI дедупит)
    const pendingIncomingRequests = pendingBookingRequests + pendingSupportMatch;

    const discussOnSessionDreams =
      clientIds.length > 0
        ? await (prisma as any).dream.count({
            where: { clientId: { in: clientIds }, discussOnSession: true }
          })
        : 0;

    const publicationDrafts = await (prisma as any).publicationPost.count({
      where: { authorId: req.user!.id, status: 'draft' }
    });

    // Новые сны за неделю
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const newDreams = clientIds.length > 0 ? await (prisma as any).dream.findMany({
      where: {
        clientId: { in: clientIds },
        createdAt: { gte: weekAgo }
      },
      select: { id: true, title: true, createdAt: true, clientId: true }
    }) : [];

    // Записи в дневниках за неделю
    const newJournalEntries = clientIds.length > 0 ? await (prisma as any).journalEntry.findMany({
      where: {
        clientId: { in: clientIds },
        createdAt: { gte: weekAgo }
      },
      select: { id: true, createdAt: true, clientId: true }
    }) : [];

    // Топ клиенты по активности (сны + сессии)
    const clientActivity = await Promise.all(
      clients.map(async (client: any) => {
        const dreamsCount = await (prisma as any).dream.count({
          where: { clientId: client.id }
        });
        const sessionsCount = await (prisma as any).therapySession.count({
          where: { clientId: client.id }
        });
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          dreamsCount,
          sessionsCount,
          totalActivity: dreamsCount + sessionsCount
        };
      })
    );

    clientActivity.sort((a, b) => b.totalActivity - a.totalActivity);

    // Частые символы (все клиенты)
    const allDreams = clientIds.length > 0 ? await (prisma as any).dream.findMany({
      where: { clientId: { in: clientIds } },
      select: { symbols: true }
    }) : [];

    const symbolFrequency: Record<string, number> = {};
    allDreams.forEach((dream: any) => {
      if (Array.isArray(dream.symbols)) {
        dream.symbols.forEach((symbol: string) => {
          symbolFrequency[symbol] = (symbolFrequency[symbol] || 0) + 1;
        });
      }
    });

    const topSymbols = Object.entries(symbolFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symbol, count]) => ({ symbol, count }));

    // Требуют внимания
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const clientsWithoutSessions = await Promise.all(
      clients.map(async (client: any) => {
        const lastSession = await (prisma as any).therapySession.findFirst({
          where: { clientId: client.id },
          orderBy: { date: 'desc' },
          select: { date: true }
        });
        if (!lastSession || new Date(lastSession.date) < twoWeeksAgo) {
          return { id: client.id, name: client.name };
        }
        return null;
      })
    );

    const unattendedDreams = clientIds.length > 0 ? await (prisma as any).dream.findMany({
      where: {
        clientId: { in: clientIds },
        createdAt: { gte: weekAgo }
      },
      include: {
        amplifications: {
          select: { id: true }
        }
      }
    }) : [];

    const dreamsWithoutAnalysis = unattendedDreams.filter((dream: any) => 
      !dream.amplifications || (Array.isArray(dream.amplifications) && dream.amplifications.length === 0)
    ).slice(0, 5);

    res.json({
      totalClients,
      activeClients,
      activeSessions: activeSessions.length,
      newDreams: newDreams.length,
      newJournalEntries: newJournalEntries.length,
      nextSession,
      pendingBookingRequests: pendingIncomingRequests,
      discussOnSessionDreams,
      publicationDrafts,
      topClients: clientActivity.slice(0, 5),
      topSymbols,
      requiresAttention: {
        clientsWithoutSessions: clientsWithoutSessions.filter(Boolean),
        dreamsWithoutAnalysis: dreamsWithoutAnalysis.map((d: any) => ({
          id: d.id,
          title: d.title,
          clientId: d.clientId
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get dashboard data' });
  }
});

// Статистика по клиенту
router.get('/analytics/clients/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const clientId = req.params.id;
    
    // Проверяем права доступа
    const client = await (prisma as any).client.findUnique({
      where: { id: clientId }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Сны клиента
    const dreams = await (prisma as any).dream.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, symbols: true, createdAt: true }
    });

    // Статистика символов
    const symbolFrequency: Record<string, number> = {};
    dreams.forEach((dream: any) => {
      if (Array.isArray(dream.symbols)) {
        dream.symbols.forEach((symbol: string) => {
          symbolFrequency[symbol] = (symbolFrequency[symbol] || 0) + 1;
        });
      }
    });

    const topSymbols = Object.entries(symbolFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symbol, count]) => ({ symbol, count }));

    // График частоты снов по времени (последние 6 месяцев)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentDreams = dreams.filter((d: any) => new Date(d.createdAt) >= sixMonthsAgo);
    
    // Группируем по месяцам
    const dreamsByMonth: Record<string, number> = {};
    recentDreams.forEach((dream: any) => {
      const date = new Date(dream.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      dreamsByMonth[monthKey] = (dreamsByMonth[monthKey] || 0) + 1;
    });

    // Сессии
    const sessions = await (prisma as any).therapySession.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { id: true, date: true, summary: true }
    });

    // Записи дневника
    const journalEntries = await (prisma as any).journalEntry.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true }
    });

    // Результаты тестов
    const testResults = await (prisma as any).testResult.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, testType: true, result: true, createdAt: true }
    });

    res.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email
      },
      stats: {
        totalDreams: dreams.length,
        totalSessions: sessions.length,
        totalJournalEntries: journalEntries.length,
        totalTests: testResults.length
      },
      topSymbols,
      dreamsByMonth: Object.entries(dreamsByMonth).map(([month, count]) => ({ month, count })),
      recentDreams: recentDreams.slice(0, 10),
      recentSessions: sessions.slice(0, 5),
      recentTests: testResults.slice(0, 5)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get client analytics' });
  }
});

export default router;


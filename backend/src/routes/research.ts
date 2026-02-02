import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Получение статистики для исследователя
router.get('/research/stats', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  try {
    const totalDreams = await (prisma as any).dream.count();
    const totalClients = await (prisma as any).client.count();
    const totalSessions = await (prisma as any).therapySession.count();
    const totalAmplifications = await (prisma as any).amplification.count();
    const totalJournalEntries = await (prisma as any).journalEntry.count();
    const totalTestResults = await (prisma as any).testResult.count();

    // Распределение по символам в снах
    const dreams = await (prisma as any).dream.findMany({
      select: { symbols: true }
    });
    
    const symbolFrequency: Record<string, number> = {};
    dreams.forEach((dream: any) => {
      if (dream.symbols && typeof dream.symbols === 'object') {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols : Object.keys(dream.symbols);
        symbols.forEach((symbol: string) => {
          symbolFrequency[symbol] = (symbolFrequency[symbol] || 0) + 1;
        });
      }
    });

    // Распределение по типам тестов
    const testResults = await (prisma as any).testResult.findMany({
      select: { testType: true }
    });
    const testDistribution: Record<string, number> = {};
    testResults.forEach((tr: any) => {
      testDistribution[tr.testType] = (testDistribution[tr.testType] || 0) + 1;
    });

    // Распределение по категориям амплификаций
    const amplifications = await (prisma as any).amplification.findMany({
      select: { category: true }
    });
    const categoryDistribution: Record<string, number> = {};
    amplifications.forEach((amp: any) => {
      const cat = amp.category || 'Без категории';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    res.json({
      counts: {
        dreams: totalDreams,
        clients: totalClients,
        sessions: totalSessions,
        amplifications: totalAmplifications,
        journalEntries: totalJournalEntries,
        testResults: totalTestResults
      },
      distributions: {
        symbols: Object.entries(symbolFrequency)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 20)
          .map(([symbol, count]) => ({ symbol, count })),
        tests: testDistribution,
        categories: categoryDistribution
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

// Матрица корреляций (совместное появление символов)
router.get('/research/matrix', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  try {
    const dreams = await (prisma as any).dream.findMany({
      select: { symbols: true, createdAt: true }
    });

    // Матрица совместного появления символов
    const cooccurrence: Record<string, Record<string, number>> = {};
    const timeSeries: Array<{ date: string; count: number }> = [];

    // Группировка по датам для временных рядов
    const dateCounts: Record<string, number> = {};
    
    dreams.forEach((dream: any) => {
      const date = new Date(dream.createdAt).toISOString().split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;

      if (dream.symbols && typeof dream.symbols === 'object') {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols : Object.keys(dream.symbols);
        for (let i = 0; i < symbols.length; i++) {
          for (let j = i + 1; j < symbols.length; j++) {
            const s1 = String(symbols[i]);
            const s2 = String(symbols[j]);
            if (!cooccurrence[s1]) cooccurrence[s1] = {};
            cooccurrence[s1][s2] = (cooccurrence[s1][s2] || 0) + 1;
            if (!cooccurrence[s2]) cooccurrence[s2] = {};
            cooccurrence[s2][s1] = (cooccurrence[s2][s1] || 0) + 1;
          }
        }
      }
    });

    // Преобразование временных рядов
    Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, count]) => {
        timeSeries.push({ date, count });
      });

    // Преобразование матрицы корреляций в массив
    const cooccurrenceArray = Object.entries(cooccurrence).map(([symbol1, pairs]) => ({
      symbol: symbol1,
      correlations: Object.entries(pairs as Record<string, number>).map(([symbol2, count]) => ({
        symbol: symbol2,
        count
      })).sort((a, b) => b.count - a.count).slice(0, 10)
    })).sort((a, b) => {
      const totalA = a.correlations.reduce((sum, c) => sum + c.count, 0);
      const totalB = b.correlations.reduce((sum, c) => sum + c.count, 0);
      return totalB - totalA;
    }).slice(0, 20);

    res.json({ cooccurrence: cooccurrenceArray, timeSeries });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch matrix' });
  }
});

// Экспорт данных (анонимный)
router.get('/research/export', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  try {
    const dreams = await (prisma as any).dream.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        symbols: true,
        createdAt: true,
        amplifications: {
          include: {
            amplification: {
              select: {
                symbol: true,
                title: true,
                category: true
              }
            }
          }
        }
      }
    });

    const sessions = await (prisma as any).therapySession.findMany({
      select: {
        id: true,
        date: true,
        topics: true,
        techniques: true,
        moodBefore: true,
        moodAfter: true,
        createdAt: true
      }
    });

    const testResults = await (prisma as any).testResult.findMany({
      select: {
        id: true,
        testType: true,
        result: true,
        createdAt: true
      }
    });

    const journalEntries = await (prisma as any).journalEntry.findMany({
      select: {
        id: true,
        content: true,
        createdAt: true
      }
    });

    // Анонимизация данных (удаление персональных идентификаторов)
    const anonymized = {
      dreams: dreams.map((d: any) => ({
        title: d.title,
        content: d.content,
        symbols: d.symbols,
        createdAt: d.createdAt,
        amplifications: d.amplifications.map((a: any) => ({
          symbol: a.amplification.symbol,
          title: a.amplification.title,
          category: a.amplification.category
        }))
      })),
      sessions: sessions.map((s: any) => ({
        date: s.date,
        topics: s.topics,
        techniques: s.techniques,
        moodBefore: s.moodBefore,
        moodAfter: s.moodAfter,
        createdAt: s.createdAt
      })),
      testResults: testResults.map((tr: any) => ({
        testType: tr.testType,
        result: tr.result,
        createdAt: tr.createdAt
      })),
      journalEntries: journalEntries.map((je: any) => ({
        content: je.content,
        createdAt: je.createdAt
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="research-export.json"');
    res.send(JSON.stringify(anonymized, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export data' });
  }
});

// Получение всех снов для исследователя
router.get('/research/dreams', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  try {
    const dreams = await (prisma as any).dream.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, name: true }
        }
      }
    });
    
    res.json({ items: dreams });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch dreams' });
  }
});

// Получение всех клиентов для исследователя (обезличенные данные)
router.get('/research/clients', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  try {
    const clients = await (prisma as any).client.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true
      }
    });
    
    res.json({ items: clients });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch clients' });
  }
});

// Получение документов клиента для исследователя
router.get('/research/clients/:id/documents', requireAuth, requireRole(['researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    
    // Получаем все документы клиента от всех психологов
    const items = await (prisma as any).clientDocument.findMany({ 
      where: { clientId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        tabName: true,
        content: true,
        updatedAt: true
      }
    });
    
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch documents' });
  }
});

export default router;

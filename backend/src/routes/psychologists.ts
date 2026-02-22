import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

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
        verified: true,
        rating: parseFloat((4.5 + Math.random() * 0.5).toFixed(1)), // Demo rating
        reviewsCount: Math.floor(Math.random() * 50) + 10 // Demo reviews count
      };
    });

    res.json({ psychologists: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists' });
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

    // Получаем все сны для анализа символов
    const dreams = await prisma.dream.findMany({
      select: { symbols: true, createdAt: true }
    });

    // Анализ символов за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDreams = dreams.filter(dream => {
      const dreamDate = new Date(dream.createdAt);
      dreamDate.setHours(0, 0, 0, 0);
      return dreamDate.getTime() === today.getTime();
    });

    // Подсчет частоты символов (сегодня)
    const todaySymbolFrequency: Record<string, number> = {};
    todayDreams.forEach((dream: any) => {
      if (dream.symbols) {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols : (typeof dream.symbols === 'string' ? [dream.symbols] : Object.keys(dream.symbols));
        symbols.forEach((symbol: string) => {
          if (symbol && typeof symbol === 'string') {
            todaySymbolFrequency[symbol] = (todaySymbolFrequency[symbol] || 0) + 1;
          }
        });
      }
    });

    // Топ 3 символа сегодня
    const topSymbolsToday = Object.entries(todaySymbolFrequency)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([symbol, count]) => ({ symbol, count }));

    // Общая частота символов (все время)
    const allSymbolFrequency: Record<string, number> = {};
    dreams.forEach((dream: any) => {
      if (dream.symbols) {
        const symbols = Array.isArray(dream.symbols) ? dream.symbols : (typeof dream.symbols === 'string' ? [dream.symbols] : Object.keys(dream.symbols));
        symbols.forEach((symbol: string) => {
          if (symbol && typeof symbol === 'string') {
            allSymbolFrequency[symbol] = (allSymbolFrequency[symbol] || 0) + 1;
          }
        });
      }
    });

    // Топ 3 самых частых символа (все время)
    const topSymbolsAll = Object.entries(allSymbolFrequency)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([symbol, count]) => ({ symbol, count }));

    res.json({
      psychologists: psychologistsCount,
      clients: clientsCount,
      dreams: dreamsCount,
      topSymbolsToday,
      topSymbolsAll
    });
  } catch (e: any) {
    console.error('Error fetching public stats:', e);
    res.status(500).json({ error: e.message || 'Failed to load statistics' });
  }
});

export default router;


import { Router } from 'express';
import { prisma } from '../db/prisma';
import {
  aggregateWordFrequencyFromTexts,
  topWordsFromAgg
} from '../utils/dreamKeywords';

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

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const todayDreams = await prisma.dream.findMany({
      where: {
        createdAt: { gte: dayStart, lt: dayEnd }
      },
      select: { title: true, content: true }
    });

    const todayAgg = aggregateWordFrequencyFromTexts(todayDreams);
    const topSymbolsToday = topWordsFromAgg(todayAgg, 10);

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

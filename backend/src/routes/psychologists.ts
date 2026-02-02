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

export default router;


import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/me/profile', requireAuth, async (req: AuthedRequest, res) => {
  const p = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  res.json(p ? {
    userId: p.userId,
    name: p.name,
    avatarUrl: p.avatarUrl,
    phone: p.phone,
    location: p.location,
    age: p.age,
    gender: p.gender,
    interests: p.interests
  } : { userId: req.user!.id, interests: [] });
});

router.put('/me/profile', requireAuth, async (req: AuthedRequest, res) => {
  const { name, age, gender, interests } = req.body ?? {};
  const p = await prisma.profile.upsert({
    where: { userId: req.user!.id },
    update: { name, age, gender, interests: interests ?? [] },
    create: { userId: req.user!.id, name, age, gender, interests: interests ?? [] }
  });
  res.json(p);
});

export default router;

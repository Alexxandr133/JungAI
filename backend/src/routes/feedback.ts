import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/dreams/:id/feedback', requireAuth, async (req, res) => {
  const items = await prisma.dreamFeedback.findMany({ where: { dreamId: req.params.id }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

router.post('/dreams/:id/feedback', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { content } = req.body ?? {};
  const f = await prisma.dreamFeedback.create({ data: { dreamId: req.params.id, psychologistId: req.user!.id, content } });
  res.status(201).json(f);
});

export default router;

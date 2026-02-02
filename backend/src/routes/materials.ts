import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/materials', requireAuth, async (_req, res) => {
  const items = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

router.post('/materials', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  const { title, type, content, tags } = req.body ?? {};
  const m = await prisma.material.create({ data: { title, type, content, tags: tags ?? [], authorId: req.user?.id } });
  res.status(201).json(m);
});

export default router;

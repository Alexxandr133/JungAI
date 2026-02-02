import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/paranormal', requireAuth, async (_req, res) => {
  const items = await prisma.paranormalCase.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items, total: items.length });
});

router.post('/paranormal', requireAuth, requireRole(['client', 'psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  const { type, description, tags } = req.body ?? {};
  const pc = await prisma.paranormalCase.create({ data: { type, description, tags: tags ?? [], userId: req.user?.id } });
  res.status(201).json(pc);
});

router.get('/paranormal/:id', requireAuth, async (req, res) => {
  const pc = await prisma.paranormalCase.findUnique({ where: { id: req.params.id } });
  if (!pc) return res.status(404).json({ error: 'Not found' });
  res.json(pc);
});

router.put('/paranormal/:id', requireAuth, requireRole(['client', 'psychologist', 'researcher', 'admin']), async (req, res) => {
  const { type, description, tags } = req.body ?? {};
  const pc = await prisma.paranormalCase.update({ where: { id: req.params.id }, data: { type, description, tags } });
  res.json(pc);
});

router.delete('/paranormal/:id', requireAuth, requireRole(['client', 'psychologist', 'researcher', 'admin']), async (req, res) => {
  await prisma.paranormalCase.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.get('/paranormal/patterns', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  res.json({ clusters: [] });
});

export default router;

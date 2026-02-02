import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/tasks', requireAuth, async (req: AuthedRequest, res) => {
  const items = await prisma.task.findMany({ where: { ownerId: req.user!.id }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

router.post('/tasks', requireAuth, async (req: AuthedRequest, res) => {
  const { clientId, title, description, dueAt } = req.body ?? {};
  const t = await prisma.task.create({ data: { ownerId: req.user!.id, clientId, title, description, status: 'todo', dueAt: dueAt ? new Date(dueAt) : null } });
  res.status(201).json(t);
});

router.put('/tasks/:id', requireAuth, async (req, res) => {
  const { title, description, status, dueAt } = req.body ?? {};
  const t = await prisma.task.update({ where: { id: req.params.id }, data: { title, description, status, dueAt: dueAt ? new Date(dueAt) : null } });
  res.json(t);
});

export default router;

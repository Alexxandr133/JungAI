import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/tasks', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const where: any = { ownerId: req.user!.id };
    if (clientId) where.clientId = clientId;
    if (status === 'open') {
      where.status = { not: 'done' };
    } else if (status === 'done' || status === 'todo' || status === 'in_progress') {
      where.status = status;
    }

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const items = await prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load tasks' });
  }
});

router.post('/tasks', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { clientId, title, description, dueAt } = req.body ?? {};
    const titleTrim = String(title ?? '').trim();
    if (!titleTrim) return res.status(400).json({ error: 'Укажите название задачи' });

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: String(clientId) } });
      if (!client) return res.status(404).json({ error: 'Client not found' });
      if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const t = await prisma.task.create({
      data: {
        ownerId: req.user!.id,
        clientId: clientId ? String(clientId) : null,
        title: titleTrim,
        description: description != null ? String(description) : null,
        status: 'todo',
        dueAt: dueAt ? new Date(dueAt) : null,
      },
    });
    res.status(201).json(t);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create task' });
  }
});

async function updateTask(req: AuthedRequest, res: any) {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.ownerId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { title, description, status, dueAt, clientId } = req.body ?? {};
    const data: any = {};
    if (title != null) data.title = String(title).trim();
    if (description !== undefined) data.description = description == null ? null : String(description);
    if (status != null) {
      const s = String(status);
      if (!['todo', 'in_progress', 'done'].includes(s)) {
        return res.status(400).json({ error: 'Некорректный статус' });
      }
      data.status = s;
    }
    if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null;
    if (clientId !== undefined) data.clientId = clientId ? String(clientId) : null;

    const t = await prisma.task.update({ where: { id: req.params.id }, data });
    res.json(t);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update task' });
  }
}

router.put('/tasks/:id', requireAuth, updateTask);
router.patch('/tasks/:id', requireAuth, updateTask);

router.delete('/tasks/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.ownerId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.task.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete task' });
  }
});

export default router;

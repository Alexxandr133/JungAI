import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();
let hasClientIdColumnCache: boolean | null = null;

async function hasParanormalClientIdColumn(): Promise<boolean> {
  if (hasClientIdColumnCache !== null) return hasClientIdColumnCache;
  try {
    const cols = await (prisma as any).$queryRawUnsafe('PRAGMA table_info("ParanormalCase")');
    hasClientIdColumnCache = Array.isArray(cols) && cols.some((c: any) => c?.name === 'clientId');
    return hasClientIdColumnCache;
  } catch {
    hasClientIdColumnCache = false;
    return false;
  }
}

router.get('/paranormal', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const where: any = {};
    const hasClientIdColumn = await hasParanormalClientIdColumn();
    let requestedClientIds: string[] | null = null;

    if (clientId && (req.user!.role === 'psychologist' || req.user!.role === 'admin')) {
      const client = await (prisma as any).client.findUnique({
        where: { id: clientId },
        select: { psychologistId: true }
      });
      if (client && (req.user!.role === 'admin' || client.psychologistId === req.user!.id)) {
        requestedClientIds = [clientId];
      } else {
        return res.json({ items: [], total: 0 });
      }
    } else if (req.user!.role === 'client') {
      const client = await (prisma as any).client.findFirst({
        where: { email: req.user!.email },
        select: { id: true }
      });
      if (client?.id) {
        requestedClientIds = [client.id];
      } else {
        where.userId = req.user!.id;
      }
    } else if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      const clients = await (prisma as any).client.findMany({
        where: { psychologistId: req.user!.id },
        select: { id: true }
      });
      const clientIds = clients.map((c: any) => c.id);
      if (clientIds.length > 0) {
        requestedClientIds = clientIds;
      } else {
        return res.json({ items: [], total: 0 });
      }
    } else {
      where.userId = req.user!.id;
    }

    let items: any[] = [];
    if (requestedClientIds && requestedClientIds.length > 0) {
      if (!hasClientIdColumn) {
        // Prisma/DB ещё не обновлены под clientId: безопасный fallback
        items = [];
      } else if (requestedClientIds.length === 1) {
        items = await (prisma as any).$queryRawUnsafe(
          'SELECT * FROM "ParanormalCase" WHERE "clientId" = ? ORDER BY "createdAt" DESC',
          requestedClientIds[0]
        );
      } else {
        const placeholders = requestedClientIds.map(() => '?').join(', ');
        items = await (prisma as any).$queryRawUnsafe(
          `SELECT * FROM "ParanormalCase" WHERE "clientId" IN (${placeholders}) ORDER BY "createdAt" DESC`,
          ...requestedClientIds
        );
      }
    } else {
      items = await (prisma as any).paranormalCase.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json({ items, total: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get paranormal cases' });
  }
});

router.post('/paranormal', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { type, description, tags, clientId } = req.body ?? {};
    const hasClientIdColumn = await hasParanormalClientIdColumn();

    let finalClientId = clientId;
    if (!finalClientId && req.user!.role === 'client') {
      const client = await (prisma as any).client.findFirst({
        where: { email: req.user!.email },
        select: { id: true }
      });
      if (client?.id) finalClientId = client.id;
    }

    const item = await (prisma as any).paranormalCase.create({
      data: {
        type: String(type ?? 'Без названия'),
        description: String(description ?? ''),
        tags: Array.isArray(tags) ? tags : [],
        userId: req.user?.id
      }
    });

    if (hasClientIdColumn && finalClientId) {
      await (prisma as any).$executeRawUnsafe(
        'UPDATE "ParanormalCase" SET "clientId" = ? WHERE "id" = ?',
        String(finalClientId),
        String(item.id)
      );
      (item as any).clientId = String(finalClientId);
    }

    if (finalClientId) {
      const client = await (prisma as any).client.findUnique({
        where: { id: finalClientId },
        select: { psychologistId: true, name: true }
      });
      if (client?.psychologistId) {
        await (prisma as any).notification.create({
          data: {
            userId: client.psychologistId,
            type: 'new_paranormal',
            title: 'Новое необъяснимое явление',
            message: `Клиент ${client.name || 'Неизвестный'} добавил запись: ${String(type || 'Без названия')}`,
            entityType: 'paranormal',
            entityId: item.id
          }
        });
      }
    }

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create paranormal case' });
  }
});

router.get('/paranormal/:id', requireAuth, requireVerification, async (req, res) => {
  try {
    const item = await (prisma as any).paranormalCase.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get paranormal case' });
  }
});

router.put('/paranormal/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { type, description, tags, clientId } = req.body ?? {};
    const hasClientIdColumn = await hasParanormalClientIdColumn();
    const existing = await (prisma as any).paranormalCase.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'admin' && req.user!.role !== 'psychologist' && existing.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await (prisma as any).paranormalCase.update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined && { type: String(type) }),
        ...(description !== undefined && { description: String(description) }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] })
      }
    });
    if (hasClientIdColumn && clientId !== undefined) {
      await (prisma as any).$executeRawUnsafe(
        'UPDATE "ParanormalCase" SET "clientId" = ? WHERE "id" = ?',
        clientId || null,
        req.params.id
      );
      (updated as any).clientId = clientId || null;
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update paranormal case' });
  }
});

router.delete('/paranormal/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const existing = await (prisma as any).paranormalCase.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user!.role !== 'admin' && req.user!.role !== 'psychologist' && existing.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own records' });
    }
    await (prisma as any).paranormalCase.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete paranormal case' });
  }
});

router.get('/paranormal/patterns', requireAuth, requireRole(['researcher', 'admin']), async (_req, res) => {
  res.json({ clusters: [] });
});

export default router;

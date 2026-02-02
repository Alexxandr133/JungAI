import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Получить уведомления пользователя
router.get('/notifications', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { unreadOnly } = req.query;
    
    const where: any = { userId: req.user!.id };
    if (unreadOnly === 'true') {
      where.read = false;
    }

    const notifications = await (prisma as any).notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const unreadCount = await (prisma as any).notification.count({
      where: { userId: req.user!.id, read: false }
    });

    res.json({ items: notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get notifications' });
  }
});

// Отметить уведомление как прочитанное
router.put('/notifications/:id/read', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notification = await (prisma as any).notification.findUnique({
      where: { id: req.params.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await (prisma as any).notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

// Отметить все как прочитанные
router.put('/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await (prisma as any).notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true }
    });

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark all as read' });
  }
});

// Удалить уведомление
router.delete('/notifications/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const notification = await (prisma as any).notification.findUnique({
      where: { id: req.params.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await (prisma as any).notification.delete({
      where: { id: req.params.id }
    });

    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

export default router;


import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/dreams', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  try {
    // Если запрос от психолога, можно фильтровать по клиенту
    const clientId = req.query.clientId as string | undefined;
    
    const where: any = {};
    if (clientId && (req.user!.role === 'psychologist' || req.user!.role === 'admin')) {
      where.clientId = clientId;
    } else if (req.user!.role === 'client') {
      // Клиент видит только свои сны
      const client = await (prisma as any).client.findFirst({
        where: { email: req.user!.email }
      });
      if (client) {
        where.clientId = client.id;
      } else {
        // Fallback на userId если клиент еще не создан
        where.userId = req.user!.id;
      }
    } else {
      where.userId = req.user!.id;
    }
    
    const items = await (prisma as any).dream.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, name: true, email: true }
        },
        amplifications: {
          include: {
            amplification: {
              select: { id: true, symbol: true, title: true }
            }
          }
        }
      }
    });
    res.json({ items, total: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get dreams' });
  }
});

router.post('/dreams', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { title, content, symbols, clientId } = req.body ?? {};
    
    // Определяем clientId
    let finalClientId = clientId;
    if (!finalClientId && req.user!.role === 'client') {
      // Для клиента находим его Client запись по email
      const client = await (prisma as any).client.findFirst({
        where: { email: req.user!.email }
      });
      if (client) {
        finalClientId = client.id;
      }
    }
    
    const dream = await (prisma as any).dream.create({
      data: {
        title,
        content,
        symbols: symbols ?? [],
        userId: req.user?.id,
        clientId: finalClientId || null
      },
      include: {
        client: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    // Создаем уведомление для психолога, если сон привязан к клиенту
    if (finalClientId) {
      const client = await (prisma as any).client.findUnique({
        where: { id: finalClientId },
        select: { psychologistId: true, name: true }
      });
      if (client) {
        await (prisma as any).notification.create({
          data: {
            userId: client.psychologistId,
            type: 'new_dream',
            title: 'Новый сон клиента',
            message: `Клиент ${client.name || 'Неизвестный'} добавил новый сон: ${title}`,
            entityType: 'dream',
            entityId: dream.id
          }
        });
      }
    }
    
    res.status(201).json(dream);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create dream' });
  }
});

router.get('/dreams/:id', requireAuth, async (req, res) => {
  try {
    const dream = await (prisma as any).dream.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: { id: true, name: true, email: true }
        },
        amplifications: {
          include: {
            amplification: {
              select: { id: true, symbol: true, title: true }
            }
          }
        }
      }
    });
    if (!dream) return res.status(404).json({ error: 'Not found' });
    res.json(dream);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get dream' });
  }
});

router.put('/dreams/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { title, content, symbols, clientId } = req.body ?? {};
    
    const dream = await (prisma as any).dream.findUnique({
      where: { id: req.params.id }
    });
    
    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }
    
    // Проверяем права доступа
    if (req.user!.role !== 'admin' && req.user!.role !== 'psychologist' && dream.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const updated = await (prisma as any).dream.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(symbols !== undefined && { symbols }),
        ...(clientId !== undefined && { clientId: clientId || null })
      }
    });
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update dream' });
  }
});

router.delete('/dreams/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const dream = await (prisma as any).dream.findUnique({ where: { id: req.params.id } });
    if (!dream) return res.status(404).json({ error: 'Dream not found' });
    
    // Проверяем права доступа: пользователь может удалять только свои сны, либо быть психологом/админом
    if (req.user!.role !== 'admin' && req.user!.role !== 'psychologist' && dream.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own dreams' });
    }
    
    await (prisma as any).dream.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete dream' });
  }
});

router.get('/dreams/similarity', requireAuth, async (_req, res) => {
  res.json({ query: {}, similar: [] });
});

export default router;

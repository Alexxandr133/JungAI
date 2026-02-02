import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Получить все амплификации (публичные + свои)
router.get('/amplifications', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const items = await (prisma as any).amplification.findMany({
      where: {
        OR: [
          { isPublic: true },
          { authorId: req.user!.id }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        // Можно добавить информацию об авторе, если нужно
      }
    });
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get amplifications' });
  }
});

// Получить амплификацию по ID
router.get('/amplifications/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const item = await (prisma as any).amplification.findUnique({
      where: { id: req.params.id }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Amplification not found' });
    }
    
    // Проверяем доступ (публичная или своя)
    if (!item.isPublic && item.authorId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get amplification' });
  }
});

// Создать новую амплификацию
router.post('/amplifications', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { symbol, title, content, category, tags, isPublic } = req.body ?? {};
    
    if (!symbol || !title || !content) {
      return res.status(400).json({ error: 'Symbol, title and content are required' });
    }
    
    const item = await (prisma as any).amplification.create({
      data: {
        symbol: symbol.trim(),
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || null,
        tags: tags || [],
        authorId: req.user!.id,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true
      }
    });
    
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create amplification' });
  }
});

// Обновить амплификацию
router.put('/amplifications/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { symbol, title, content, category, tags, isPublic } = req.body ?? {};
    
    // Проверяем существование и права доступа
    const existing = await (prisma as any).amplification.findUnique({
      where: { id: req.params.id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Amplification not found' });
    }
    
    if (existing.authorId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const item = await (prisma as any).amplification.update({
      where: { id: req.params.id },
      data: {
        ...(symbol && { symbol: symbol.trim() }),
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(tags !== undefined && { tags }),
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) })
      }
    });
    
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update amplification' });
  }
});

// Удалить амплификацию
router.delete('/amplifications/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const existing = await (prisma as any).amplification.findUnique({
      where: { id: req.params.id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Amplification not found' });
    }
    
    if (existing.authorId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await (prisma as any).amplification.delete({
      where: { id: req.params.id }
    });
    
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete amplification' });
  }
});

// Поиск амплификаций
router.get('/amplifications/search/:query', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const query = req.params.query.toLowerCase();
    
    // SQLite не поддерживает case-insensitive поиск напрямую, поэтому фильтруем в памяти
    const allItems = await (prisma as any).amplification.findMany({
      where: {
        OR: [
          { isPublic: true },
          { authorId: req.user!.id }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const items = allItems.filter((item: any) => {
      const symbol = (item.symbol || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      const content = (item.content || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const tags = Array.isArray(item.tags) ? item.tags.map((t: any) => String(t).toLowerCase()) : [];
      
      return symbol.includes(query) || 
             title.includes(query) || 
             content.includes(query) || 
             category.includes(query) ||
             tags.some((t: string) => t.includes(query));
    });
    
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to search amplifications' });
  }
});

// Привязать амплификацию к сну
router.post('/amplifications/:amplificationId/attach-to-dream/:dreamId', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { amplificationId, dreamId } = req.params;
    const { note } = req.body ?? {};

    // Проверяем существование сна и права доступа
    const dream = await (prisma as any).dream.findUnique({
      where: { id: dreamId },
      include: { client: true }
    });

    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    if (dream.client && req.user!.role !== 'admin' && dream.client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Проверяем существование амплификации
    const amplification = await (prisma as any).amplification.findUnique({
      where: { id: amplificationId }
    });

    if (!amplification) {
      return res.status(404).json({ error: 'Amplification not found' });
    }

    // Проверяем, не привязана ли уже
    const existing = await (prisma as any).dreamAmplification.findFirst({
      where: {
        dreamId,
        amplificationId
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Amplification already attached to this dream' });
    }

    const link = await (prisma as any).dreamAmplification.create({
      data: {
        dreamId,
        amplificationId,
        addedBy: req.user!.id,
        note: note || null
      },
      include: {
        amplification: {
          select: { id: true, symbol: true, title: true }
        }
      }
    });

    res.status(201).json(link);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to attach amplification' });
  }
});

// Отвязать амплификацию от сна
router.delete('/amplifications/:amplificationId/detach-from-dream/:dreamId', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { amplificationId, dreamId } = req.params;

    const link = await (prisma as any).dreamAmplification.findFirst({
      where: {
        dreamId,
        amplificationId
      }
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Проверяем права доступа
    if (link.addedBy !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await (prisma as any).dreamAmplification.deleteMany({
      where: {
        dreamId,
        amplificationId
      }
    });

    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to detach amplification' });
  }
});

// Получить амплификации для сна
router.get('/dreams/:dreamId/amplifications', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const dream = await (prisma as any).dream.findUnique({
      where: { id: req.params.dreamId },
      include: {
        client: true,
        amplifications: {
          include: {
            amplification: true
          }
        }
      }
    });

    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    // Проверяем права доступа
    if (dream.client && req.user!.role !== 'admin' && dream.client.psychologistId !== req.user!.id) {
      if (req.user!.role === 'client') {
        const client = await (prisma as any).client.findFirst({
          where: { email: req.user!.email }
        });
        if (!client || client.id !== dream.clientId) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ items: dream.amplifications || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get dream amplifications' });
  }
});

export default router;


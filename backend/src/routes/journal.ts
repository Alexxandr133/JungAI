import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

async function ensureJournalMoodTagColumn() {
  try {
    const rows = (await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("JournalEntry")`)) as Array<{ name: string }>;
    if (!rows.some((r) => r.name === 'moodTag')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "JournalEntry" ADD COLUMN "moodTag" TEXT`);
    }
  } catch {
    /* ignore */
  }
}

// Получить все записи дневника клиента (для самого клиента)
router.get('/journal/entries', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureJournalMoodTagColumn();
    // Находим клиента по email пользователя
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const entries = await prisma.journalEntry.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ items: entries });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get journal entries' });
  }
});

// Создать новую запись дневника
router.post('/journal/entries', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureJournalMoodTagColumn();
    const { content, moodTag } = req.body ?? {};
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Находим клиента по email пользователя
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const tag =
      typeof moodTag === 'string' && moodTag.trim() ? moodTag.trim().slice(0, 40) : null;
    
    const entry = await prisma.journalEntry.create({
      data: {
        clientId: client.id,
        content: content.trim(),
        moodTag: tag
      }
    });
    
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create journal entry' });
  }
});

// Обновить запись дневника
router.put('/journal/entries/:id', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { content, moodTag } = req.body ?? {};
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Находим клиента по email пользователя
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Проверяем, что запись принадлежит этому клиенту
    const existing = await prisma.journalEntry.findUnique({
      where: { id: req.params.id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    if (existing.clientId !== client.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const tag =
      moodTag === undefined
        ? undefined
        : typeof moodTag === 'string' && moodTag.trim()
          ? moodTag.trim().slice(0, 40)
          : null;
    
    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data: {
        content: content.trim(),
        ...(tag !== undefined ? { moodTag: tag } : {})
      }
    });
    
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update journal entry' });
  }
});

// Удалить запись дневника
router.delete('/journal/entries/:id', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    // Находим клиента по email пользователя
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Проверяем, что запись принадлежит этому клиенту
    const existing = await prisma.journalEntry.findUnique({
      where: { id: req.params.id }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    if (existing.clientId !== client.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await prisma.journalEntry.delete({
      where: { id: req.params.id }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete journal entry' });
  }
});

export default router;


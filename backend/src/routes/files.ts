import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import path from 'path';
import fs from 'fs';

const router = Router();

// Настройка директории для загрузки файлов
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Временная заглушка для загрузки файлов (без multer пока)
// TODO: Установить multer: npm install multer @types/multer
router.post('/files/upload', requireAuth, async (req: AuthedRequest, res) => {
  try {
    // Временная реализация - принимаем только метаданные файла
    // Для полной реализации нужно установить multer
    const { entityType, entityId, fileName, filePath, mimeType, size } = req.body ?? {};
    
    if (!entityType || !entityId || !fileName) {
      return res.status(400).json({ error: 'entityType, entityId and fileName are required' });
    }

    // Проверяем права доступа в зависимости от типа сущности
    if (entityType === 'session') {
      const session = await (prisma as any).therapySession.findUnique({
        where: { id: entityId },
        include: { client: true }
      });
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (req.user!.role !== 'admin' && session.client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (entityType === 'dream') {
      const dream = await (prisma as any).dream.findUnique({
        where: { id: entityId },
        include: { client: true }
      });
      if (!dream) {
        return res.status(404).json({ error: 'Dream not found' });
      }
      if (dream.client && req.user!.role !== 'admin' && dream.client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const fileAttachment = await (prisma as any).fileAttachment.create({
      data: {
        fileName: fileName,
        filePath: filePath || path.join(uploadDir, Date.now().toString() + path.extname(fileName)),
        mimeType: mimeType || 'application/octet-stream',
        size: size || 0,
        entityType,
        entityId,
        uploadedBy: req.user!.id
      }
    });

    res.status(201).json(fileAttachment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Получить файлы для сущности
router.get('/files/:entityType/:entityId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { entityType, entityId } = req.params;

    const files = await (prisma as any).fileAttachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' }
    });

    // Проверяем права доступа
    if (entityType === 'session') {
      const session = await (prisma as any).therapySession.findUnique({
        where: { id: entityId },
        include: { client: true }
      });
      if (session && session.client && req.user!.role !== 'admin' && session.client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ items: files });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get files' });
  }
});

// Скачать файл
router.get('/files/:id/download', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const file = await (prisma as any).fileAttachment.findUnique({
      where: { id: req.params.id }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Проверяем права доступа
    if (file.entityType === 'session') {
      const session = await (prisma as any).therapySession.findUnique({
        where: { id: file.entityId },
        include: { client: true }
      });
      if (session && session.client && req.user!.role !== 'admin' && session.client.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(file.filePath, file.fileName);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// Удалить файл
router.delete('/files/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const file = await (prisma as any).fileAttachment.findUnique({
      where: { id: req.params.id }
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Проверяем права доступа
    if (file.uploadedBy !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Удаляем файл с диска
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    await (prisma as any).fileAttachment.delete({
      where: { id: req.params.id }
    });

    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

export default router;


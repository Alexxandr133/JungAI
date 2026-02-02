import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Все маршруты требуют авторизации и роли admin
router.use(requireAuth);
router.use((req: AuthedRequest, res, next) => requireRole(['admin'])(req, res, next));

// Получить все запросы на верификацию
router.get('/verification', async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.verificationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    // Получаем профили для всех пользователей
    const userIds = requests.map(r => r.userId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, name: true, avatarUrl: true, phone: true, location: true, specialization: true, experience: true, bio: true }
    });
    
    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    
    const formatted = requests.map(r => {
      const profile = profileMap.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        userName: profile?.name || null,
        userEmail: r.user.email,
        avatarUrl: profile?.avatarUrl || null,
        phone: profile?.phone || null,
        location: profile?.location || null,
        specialization: profile?.specialization || null,
        experience: profile?.experience || null,
        bio: profile?.bio || null,
        documentPath: r.documentPath,
        fileName: r.fileName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() || null,
        comment: r.comment || null
      };
    });
    
    res.json({ requests: formatted });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load verification requests' });
  }
});

// Получить документ верификации
router.get('/verification/:id/document', async (req: AuthedRequest, res) => {
  try {
    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const filePath = request.documentPath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load document' });
  }
});

// Рассмотреть запрос на верификацию
router.post('/verification/:id/review', async (req: AuthedRequest, res) => {
  try {
    const { status, comment } = req.body ?? {};
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Комментарий обязателен при отклонении
    if (status === 'rejected' && (!comment || !comment.trim())) {
      return res.status(400).json({ error: 'Комментарий обязателен при отклонении запроса' });
    }
    
    const request = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Обновляем запрос
    await prisma.verificationRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        comment: comment ? comment.trim() : null
      }
    });
    
    // Если одобрено, обновляем статус пользователя
    if (status === 'approved') {
      await prisma.user.update({
        where: { id: request.userId },
        data: { isVerified: true }
      });
    } else {
      // Если отклонено, сбрасываем статус
      await prisma.user.update({
        where: { id: request.userId },
        data: { isVerified: false }
      });
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to review request' });
  }
});

// Статистика для дашборда админа
router.get('/dashboard', async (req: AuthedRequest, res) => {
  try {
    // Статистика по техподдержке
    const allSupportRequests = await prisma.supportRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const supportStats = {
      total: allSupportRequests.length,
      open: allSupportRequests.filter(r => r.status === 'open').length,
      inProgress: allSupportRequests.filter(r => r.status === 'in_progress').length,
      resolved: allSupportRequests.filter(r => r.status === 'resolved').length,
      closed: allSupportRequests.filter(r => r.status === 'closed').length,
      withWorkAreaAccess: allSupportRequests.filter(r => r.allowWorkAreaAccess && ['open', 'in_progress'].includes(r.status)).length
    };

    // Статистика по верификации
    const verificationRequests = await prisma.verificationRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const verificationStats = {
      total: verificationRequests.length,
      pending: verificationRequests.filter(r => r.status === 'pending').length,
      approved: verificationRequests.filter(r => r.status === 'approved').length,
      rejected: verificationRequests.filter(r => r.status === 'rejected').length
    };

    // Общая статистика системы
    const systemStats = {
      totalUsers: await prisma.user.count(),
      totalPsychologists: await prisma.user.count({ where: { role: 'psychologist' } }),
      totalClients: await prisma.client.count(),
      totalDreams: await prisma.dream.count(),
      totalSessions: await prisma.therapySession.count()
    };

    // Последние запросы в техподдержку
    const recentSupportRequests = allSupportRequests.slice(0, 5).map(r => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
      psychologistId: r.psychologistId
    }));

    // Получаем информацию о психологах для последних запросов
    const psychologistIds = [...new Set(recentSupportRequests.map(r => r.psychologistId))];
    const psychologists = await prisma.user.findMany({
      where: { id: { in: psychologistIds } },
      select: { id: true, email: true }
    });
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: psychologistIds } },
      select: { userId: true, name: true }
    });

    const psychMap = new Map(psychologists.map(p => [p.id, p]));
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const recentWithNames = recentSupportRequests.map(r => {
      const psych = psychMap.get(r.psychologistId);
      const profile = profileMap.get(r.psychologistId);
      return {
        ...r,
        psychologistEmail: psych?.email || null,
        psychologistName: profile?.name || null
      };
    });

    res.json({
      support: supportStats,
      verification: verificationStats,
      system: systemStats,
      recentSupportRequests: recentWithNames
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось загрузить статистику' });
  }
});

export default router;


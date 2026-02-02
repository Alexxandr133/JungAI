import { Router } from 'express';
import { requireAuth, AuthedRequest, requireVerification } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Психолог/Исследователь: создать запрос в техподдержку
router.post('/support/requests', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { title, description, allowWorkAreaAccess, clientId } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Заголовок и описание обязательны' });
    }

    const request = await prisma.supportRequest.create({
      data: {
        psychologistId: req.user!.id,
        title,
        description,
        allowWorkAreaAccess: allowWorkAreaAccess === true,
        clientId: allowWorkAreaAccess && clientId ? clientId : null,
        status: 'open'
      }
    });

    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось создать запрос' });
  }
});

// Психолог/Исследователь: получить свои запросы
router.get('/support/requests', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      where: { psychologistId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({ items: requests });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось получить запросы' });
  }
});

// Админ: получить все запросы
router.get('/admin/support/requests', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Получаем информацию о психологах
    const psychologistIds = [...new Set(requests.map(r => r.psychologistId))];
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

    const formatted = requests.map(r => {
      const psych = psychMap.get(r.psychologistId);
      const profile = profileMap.get(r.psychologistId);
      return {
        ...r,
        psychologistEmail: psych?.email || null,
        psychologistName: profile?.name || null
      };
    });

    res.json({ items: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось получить запросы' });
  }
});

// Админ: ответить на запрос
router.post('/admin/support/requests/:id/respond', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { adminResponse, status } = req.body;

    if (!adminResponse) {
      return res.status(400).json({ error: 'Ответ обязателен' });
    }

    const request = await prisma.supportRequest.update({
      where: { id },
      data: {
        adminResponse,
        status: status || 'resolved',
        respondedBy: req.user!.id,
        respondedAt: new Date()
      }
    });

    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось ответить на запрос' });
  }
});

// Админ: получить запросы с доступом к рабочей области
router.get('/admin/support/open-access', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const requests = await prisma.supportRequest.findMany({
      where: {
        allowWorkAreaAccess: true,
        status: { in: ['open', 'in_progress'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Получаем информацию о психологах
    const psychologistIds = [...new Set(requests.map(r => r.psychologistId))];
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

    const formatted = requests.map(r => {
      const psych = psychMap.get(r.psychologistId);
      const profile = profileMap.get(r.psychologistId);
      return {
        ...r,
        psychologistEmail: psych?.email || null,
        psychologistName: profile?.name || null
      };
    });

    res.json({ items: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось получить запросы' });
  }
});

// Клиент: запросить чат или сессию с психологом
router.post('/support/request', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { psychologistId, type, message } = req.body;
    
    if (!psychologistId || !type || !message) {
      return res.status(400).json({ error: 'ID психолога, тип запроса и сообщение обязательны' });
    }
    
    if (!['chat', 'session'].includes(type)) {
      return res.status(400).json({ error: 'Тип запроса должен быть "chat" или "session"' });
    }
    
    // Проверяем, существует ли психолог
    const psychologist = await prisma.user.findUnique({
      where: { id: psychologistId },
      select: { id: true, role: true }
    });
    
    if (!psychologist || psychologist.role !== 'psychologist') {
      return res.status(404).json({ error: 'Психолог не найден' });
    }
    
    // Находим клиента
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    // Создаём запрос в техподдержку (используем существующую модель SupportRequest)
    // Но для этого нужно, чтобы psychologistId был ID психолога, который получает запрос
    // А clientId - ID клиента, который отправляет запрос
    // Но в модели SupportRequest psychologistId - это ID психолога, который создал запрос
    // Нужно создать новую модель или использовать существующую по-другому
    
    // Временно создаём запрос через SupportRequest, но с обратной логикой
    // psychologistId - это ID психолога, которому отправляется запрос
    // Но в модели это поле для психолога, который создал запрос
    // Нужно создать отдельную модель для запросов от клиентов к психологам
    
    // Пока что создадим простую запись в базе через SupportRequest
    // Но это не совсем правильно, так как модель не предназначена для этого
    // В будущем нужно создать отдельную модель ClientRequest или PsychologistRequest
    
    // Временно используем SupportRequest, но с обратной логикой
    // psychologistId - это ID психолога, которому отправляется запрос
    const request = await prisma.supportRequest.create({
      data: {
        psychologistId: psychologistId, // ID психолога, которому отправляется запрос
        title: type === 'chat' ? 'Запрос на чат' : 'Запрос на сессию',
        description: `Клиент ${client.name || req.user!.email} хочет ${type === 'chat' ? 'начать чат' : 'записаться на сессию'}.\n\nЦель запроса: ${message}`,
        allowWorkAreaAccess: false,
        clientId: client.id,
        status: 'open'
      }
    });
    
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось создать запрос' });
  }
});

// Психолог: получить запросы от клиентов
router.get('/psychologist/requests', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    // Получаем запросы, где psychologistId - это ID текущего психолога
    // и clientId не null (это запрос от клиента)
    const requests = await prisma.supportRequest.findMany({
      where: { 
        psychologistId: req.user!.id,
        clientId: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    res.json({ items: requests });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось получить запросы' });
  }
});

// Психолог: принять или отклонить запрос от клиента
router.post('/psychologist/requests/:id/respond', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' или 'decline'
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Действие должно быть "accept" или "decline"' });
    }
    
    const request = await prisma.supportRequest.findUnique({
      where: { id },
      include: { client: true }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }
    
    if (request.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    if (action === 'accept' && request.clientId) {
      // Назначаем психолога клиенту
      await prisma.client.update({
        where: { id: request.clientId },
        data: { psychologistId: req.user!.id }
      });
    }
    
    // Обновляем статус запроса
    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        status: action === 'accept' ? 'resolved' : 'declined',
        adminResponse: action === 'accept' ? 'Запрос принят' : 'Запрос отклонён',
        respondedBy: req.user!.id,
        respondedAt: new Date()
      }
    });
    
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Не удалось обработать запрос' });
  }
});

export default router;


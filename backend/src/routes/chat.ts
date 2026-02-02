import { Router } from 'express';
import { requireAuth, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

router.get('/chat/rooms', requireAuth, requireVerification, async (_req, res) => {
  const items = await prisma.chatRoom.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

router.post('/chat/rooms', requireAuth, requireVerification, async (req, res) => {
  const { name } = req.body ?? {};
  const r = await prisma.chatRoom.create({ data: { name } });
  res.status(201).json(r);
});

router.get('/chat/rooms/:id/messages', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  const items = await prisma.chatMessage.findMany({ where: { roomId: req.params.id }, orderBy: { createdAt: 'asc' } });
  
  // Отмечаем время последнего просмотра комнаты пользователем
  // Используем простой подход - храним в таблице ChatRoomView или обновляем через API
  // Пока что просто возвращаем сообщения, а подсчет непрочитанных будет учитывать время последнего просмотра
  
  res.json({ items });
});

router.post('/chat/rooms/:id/messages', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  const { content } = req.body ?? {};
  const m = await prisma.chatMessage.create({ data: { roomId: req.params.id, authorId: req.user!.id, content } });
  res.status(201).json(m);
});

// Отметить комнату как просмотренную
router.post('/chat/rooms/:id/read', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  try {
    // Сохраняем время последнего просмотра в localStorage на клиенте
    // На бэкенде просто возвращаем успех
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

// Получить количество непрочитанных сообщений
router.get('/chat/unread-count', requireAuth, requireVerification, async (req: AuthedRequest, res) => {
  try {
    // Получаем время последнего просмотра комнат из запроса (JSON объект roomId -> timestamp)
    const { roomViews } = req.query;
    let roomViewsMap: Record<string, Date> = {};
    
    if (roomViews && typeof roomViews === 'string') {
      try {
        const parsed = JSON.parse(roomViews);
        // Преобразуем строки в Date объекты
        for (const key in parsed) {
          if (parsed[key]) {
            const date = new Date(parsed[key]);
            if (!isNaN(date.getTime())) {
              roomViewsMap[key] = date;
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
    
    // Получаем все комнаты
    const rooms = await prisma.chatRoom.findMany();
    
    let unreadCount = 0;
    for (const room of rooms) {
      // Получаем время последнего просмотра этой комнаты
      const lastViewedTime = roomViewsMap[room.id];
      
      if (lastViewedTime) {
        // Считаем только сообщения, созданные после последнего просмотра
        const unreadInRoom = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            authorId: { not: req.user!.id },
            createdAt: { gt: lastViewedTime }
          }
        });
        unreadCount += unreadInRoom;
      } else {
        // Если нет времени просмотра, проверяем, есть ли вообще сообщения в комнате
        const totalMessages = await prisma.chatMessage.count({
          where: { roomId: room.id }
        });
        
        // Если в комнате нет сообщений, пропускаем
        if (totalMessages === 0) continue;
        
        // Если есть сообщения, но нет времени просмотра, используем логику - считаем после последнего сообщения пользователя
        const lastUserMessage = await prisma.chatMessage.findFirst({
          where: {
            roomId: room.id,
            authorId: req.user!.id
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (lastUserMessage) {
          // Пользователь писал в комнате - считаем только сообщения после его последнего сообщения
          const unreadInRoom = await prisma.chatMessage.count({
            where: {
              roomId: room.id,
              authorId: { not: req.user!.id },
              createdAt: { gt: lastUserMessage.createdAt }
            }
          });
          unreadCount += unreadInRoom;
        }
        // Если пользователь не писал в комнате и нет времени просмотра, НЕ считаем сообщения непрочитанными
        // (пользователь должен сначала открыть комнату, чтобы сообщения считались прочитанными)
      }
    }

    res.json({ unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

export default router;

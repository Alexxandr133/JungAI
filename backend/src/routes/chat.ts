import { Router } from 'express';
import { requireAuth, requireVerification, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// КРИТИЧНО: Убрали requireVerification для клиентов - они должны иметь доступ к чату
// Для психологов верификация все еще требуется через requireRole
router.get('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    let items: any[] = [];
    
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      // Для психолога: только комнаты с прикрепленными клиентами
      const clients = await prisma.client.findMany({
        where: { psychologistId: req.user!.id },
        select: { name: true }
      });
      
      const clientNames = clients.map(c => c.name);
      
      if (clientNames.length > 0) {
        items = await prisma.chatRoom.findMany({
          where: {
            name: { in: clientNames }
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    } else if (req.user!.role === 'client') {
      // Для клиента: только комнаты, где клиент отправил хотя бы одно сообщение
      const clientRooms = await prisma.chatMessage.findMany({
        where: { authorId: req.user!.id },
        select: { roomId: true },
        distinct: ['roomId']
      });
      
      const roomIds = clientRooms.map(m => m.roomId);
      
      if (roomIds.length > 0) {
        items = await prisma.chatRoom.findMany({
          where: {
            id: { in: roomIds }
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    }
    
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get rooms' });
  }
});

router.post('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { name } = req.body ?? {};
    const r = await prisma.chatRoom.create({ data: { name } });
    res.status(201).json(r);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

router.get('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const items = await prisma.chatMessage.findMany({ where: { roomId: id }, orderBy: { createdAt: 'asc' } });
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

router.post('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body ?? {};
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    const m = await prisma.chatMessage.create({ 
      data: { 
        roomId: id, 
        authorId: req.user!.id, 
        content: content.trim() 
      } 
    });
    res.status(201).json(m);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Отметить комнату как просмотренную
router.post('/chat/rooms/:id/read', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    // Сохраняем время последнего просмотра в localStorage на клиенте
    // На бэкенде просто возвращаем успех
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

// Получить количество непрочитанных сообщений
// Для клиентов не требуется верификация, только для психологов
router.get('/chat/unread-count', requireAuth, async (req: AuthedRequest, res) => {
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
    
    // Получаем комнаты в зависимости от роли пользователя
    let rooms: any[] = [];
    
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      // Для психолога: только комнаты с прикрепленными клиентами
      const clients = await prisma.client.findMany({
        where: { psychologistId: req.user!.id },
        select: { name: true }
      });
      
      const clientNames = clients.map(c => c.name);
      
      if (clientNames.length > 0) {
        rooms = await prisma.chatRoom.findMany({
          where: {
            name: { in: clientNames }
          }
        });
      }
    } else if (req.user!.role === 'client') {
      // Для клиента: только комнаты, где клиент отправил хотя бы одно сообщение
      const clientRooms = await prisma.chatMessage.findMany({
        where: { authorId: req.user!.id },
        select: { roomId: true },
        distinct: ['roomId']
      });
      
      const roomIds = clientRooms.map(m => m.roomId);
      
      if (roomIds.length > 0) {
        rooms = await prisma.chatRoom.findMany({
          where: {
            id: { in: roomIds }
          }
        });
      }
    } else {
      // Для других ролей - все комнаты (если нужно)
      rooms = await prisma.chatRoom.findMany();
    }
    
    let unreadCount = 0;
    for (const room of rooms) {
      // Получаем время последнего просмотра этой комнаты
      const lastViewedTime = roomViewsMap[room.id];
      
      if (lastViewedTime) {
        // Считаем только сообщения, созданные после последнего просмотра
        // Используем строгое сравнение "больше" - сообщения, созданные после времени просмотра
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

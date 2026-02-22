import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Получить комнаты чата
router.get('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      // Для психолога: все комнаты с его клиентами
      const rooms = await prisma.chatRoom.findMany({
        where: { psychologistId: req.user!.id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              createdAt: true,
              authorId: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Получить профили клиентов для аватаров
      const clientEmails = rooms.map(r => r.client?.email).filter(Boolean) as string[];
      const clientUsers = clientEmails.length > 0 ? await prisma.user.findMany({
        where: { email: { in: clientEmails } },
        include: { profile: { select: { avatarUrl: true, name: true } } }
      }) : [];
      
      const clientUserMap = new Map(clientUsers.map(u => [u.email, u]));
      
      const roomsWithAvatars = rooms.map(room => ({
        ...room,
        client: room.client ? {
          ...room.client,
          avatarUrl: room.client.email ? clientUserMap.get(room.client.email)?.profile?.avatarUrl || null : null,
          displayName: room.client.email ? (clientUserMap.get(room.client.email)?.profile?.name || room.client.name) : room.client.name
        } : null
      }));
      
      res.json({ items: roomsWithAvatars });
    } else if (req.user!.role === 'client') {
      // Для клиента: комната с его психологом
      const client = await prisma.client.findFirst({
        where: { 
          email: req.user!.email 
        },
        select: { id: true, psychologistId: true }
      });
      
      if (!client) {
        return res.json({ items: [] });
      }
      
      const room = await prisma.chatRoom.findUnique({
        where: { clientId: client.id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              content: true,
              createdAt: true,
              authorId: true
            }
          }
        }
      });
      
      if (!room) {
        return res.json({ items: [] });
      }
      
      // Получить профиль психолога для имени и аватара
      const psychologist = await prisma.user.findUnique({
        where: { id: client.psychologistId },
        include: {
          profile: {
            select: {
              name: true,
              avatarUrl: true
            }
          }
        }
      });
      
      const roomWithPsychologist = {
        ...room,
        psychologist: psychologist ? {
          id: psychologist.id,
          name: psychologist.profile?.name || psychologist.email.split('@')[0],
          avatarUrl: psychologist.profile?.avatarUrl || null
        } : null
      };
      
      console.log('[GET /chat/rooms] Client room with psychologist:', {
        roomId: roomWithPsychologist.id,
        psychologist: roomWithPsychologist.psychologist,
        psychologistId: client.psychologistId
      });
      
      res.json({ items: [roomWithPsychologist] });
    } else {
      res.json({ items: [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get rooms' });
  }
});

// Получить сообщения комнаты
router.get('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем доступ к комнате
    const room = await prisma.chatRoom.findUnique({
      where: { id },
      select: { psychologistId: true, clientId: true }
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Проверяем, что пользователь имеет доступ к этой комнате
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      if (room.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user!.role === 'client') {
      const client = await prisma.client.findFirst({
        where: { email: req.user!.email },
        select: { id: true }
      });
      
      if (!client || room.clientId !== client.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        room: {
          select: {
            client: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    res.json({ items: messages });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

// Отправить сообщение
router.post('/chat/rooms/:id/messages', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body ?? {};
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    
    // Проверяем доступ к комнате
    const room = await prisma.chatRoom.findUnique({
      where: { id },
      select: { psychologistId: true, clientId: true }
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Проверяем, что пользователь имеет доступ к этой комнате
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      if (room.psychologistId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user!.role === 'client') {
      const client = await prisma.client.findFirst({
        where: { email: req.user!.email },
        select: { id: true }
      });
      
      if (!client || room.clientId !== client.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const message = await prisma.chatMessage.create({
      data: {
        roomId: id,
        authorId: req.user!.id,
        content: content.trim()
      }
    });
    
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Отметить комнату как просмотренную
router.post('/chat/rooms/:id/read', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

// Получить количество непрочитанных сообщений
router.get('/chat/unread-count', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { roomViews } = req.query;
    let roomViewsMap: Record<string, Date> = {};
    
    if (roomViews && typeof roomViews === 'string') {
      try {
        const parsed = JSON.parse(roomViews);
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
    
    let rooms: any[] = [];
    
    if (req.user!.role === 'psychologist' || req.user!.role === 'admin') {
      rooms = await prisma.chatRoom.findMany({
        where: { psychologistId: req.user!.id }
      });
    } else if (req.user!.role === 'client') {
      const client = await prisma.client.findFirst({
        where: { email: req.user!.email },
        select: { id: true }
      });
      
      if (client) {
        const room = await prisma.chatRoom.findUnique({
          where: { clientId: client.id }
        });
        
        if (room) {
          rooms = [room];
        }
      }
    }
    
    let unreadCount = 0;
    for (const room of rooms) {
      const lastViewedTime = roomViewsMap[room.id];
      
      if (lastViewedTime) {
        const unreadInRoom = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            authorId: { not: req.user!.id },
            createdAt: { gt: lastViewedTime }
          }
        });
        unreadCount += unreadInRoom;
      } else {
        const totalMessages = await prisma.chatMessage.count({
          where: { roomId: room.id }
        });
        
        if (totalMessages === 0) continue;
        
        const lastUserMessage = await prisma.chatMessage.findFirst({
          where: {
            roomId: room.id,
            authorId: req.user!.id
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (lastUserMessage) {
          const unreadInRoom = await prisma.chatMessage.count({
            where: {
              roomId: room.id,
              authorId: { not: req.user!.id },
              createdAt: { gt: lastUserMessage.createdAt }
            }
          });
          unreadCount += unreadInRoom;
        }
      }
    }

    res.json({ unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get unread count' });
  }
});

export default router;

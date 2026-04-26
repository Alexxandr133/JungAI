import { Router } from 'express';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { getClientVisibleChatRoomIds, userCanAccessChatRoom } from '../utils/chatAccess';
import { emitChatNewMessage } from '../realtime/chatHub';

const router = Router();

function extractRoomIdFromDescription(description: string | null | undefined): string | null {
  const match = String(description || '').match(/\[chatRoomId:([^\]]+)\]/);
  return match?.[1] || null;
}

async function getVisibleRoomsForUser(user: { id: string; email: string; role: string }) {
  if (user.role === 'psychologist' || user.role === 'admin') {
    const attachedClients = await prisma.client.findMany({
      where: { psychologistId: user.id },
      select: { name: true }
    });
    const attachedClientNames = attachedClients.map(c => c.name).filter(Boolean);

    const requestItems = await prisma.supportRequest.findMany({
      where: { psychologistId: user.id, clientId: { not: null } },
      select: {
        description: true,
        client: { select: { name: true } }
      }
    });

    const requestRoomIdToClientName = new Map<string, string>();
    for (const req of requestItems) {
      const roomId = extractRoomIdFromDescription(req.description);
      if (roomId) requestRoomIdToClientName.set(roomId, req.client?.name || 'Клиент');
    }

    const requestRoomIds = Array.from(requestRoomIdToClientName.keys());
    const roomWhere =
      attachedClientNames.length > 0 || requestRoomIds.length > 0
        ? {
            OR: [
              ...(attachedClientNames.length > 0 ? [{ name: { in: attachedClientNames } }] : []),
              ...(requestRoomIds.length > 0 ? [{ id: { in: requestRoomIds } }] : [])
            ]
          }
        : null;

    const rooms = roomWhere
      ? await prisma.chatRoom.findMany({ where: roomWhere as any, orderBy: { createdAt: 'desc' } })
      : [];

    return rooms.map(room => ({
      ...room,
      displayName: requestRoomIdToClientName.get(room.id) || room.name || 'Чат'
    }));
  }

  if (user.role === 'client') {
    const visibleIds = new Set<string>(await getClientVisibleChatRoomIds(user.id, user.email));
    const client = await prisma.client.findFirst({ where: { email: user.email }, select: { id: true } });

    const requestItems = client
      ? await prisma.supportRequest.findMany({
          where: { clientId: client.id },
          select: {
            description: true,
            psychologistId: true
          }
        })
      : [];

    const psychologistIds = Array.from(new Set(requestItems.map(r => r.psychologistId).filter(Boolean)));
    const psychologists = psychologistIds.length
      ? await prisma.user.findMany({
          where: { id: { in: psychologistIds } },
          select: { id: true, email: true }
        })
      : [];
    const psychNameById = new Map(psychologists.map(p => [p.id, p.email?.split('@')[0] || 'Психолог']));

    const requestRoomIdToPsychName = new Map<string, string>();
    for (const req of requestItems) {
      const roomId = extractRoomIdFromDescription(req.description);
      if (!roomId) continue;
      visibleIds.add(roomId);
      const psychName = psychNameById.get(req.psychologistId) || 'Психолог';
      requestRoomIdToPsychName.set(roomId, psychName);
    }

    const roomIds = Array.from(visibleIds);
    const rooms =
      roomIds.length > 0
        ? await prisma.chatRoom.findMany({
            where: { id: { in: roomIds } },
            orderBy: { createdAt: 'desc' }
          })
        : [];

    return rooms.map(room => ({
      ...room,
      displayName: requestRoomIdToPsychName.get(room.id) || room.name || 'Чат'
    }));
  }

  const rooms = await prisma.chatRoom.findMany({ orderBy: { createdAt: 'desc' } });
  return rooms.map(room => ({ ...room, displayName: room.name || 'Чат' }));
}

// КРИТИЧНО: Убрали requireVerification для клиентов - они должны иметь доступ к чату
// Для психологов верификация все еще требуется через requireRole
router.get('/chat/rooms', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const items = await getVisibleRoomsForUser(req.user!);
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

    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const m = await prisma.chatMessage.create({
      data: {
        roomId: id,
        authorId: req.user!.id,
        content: content.trim()
      }
    });
    const payload = {
      id: m.id,
      roomId: m.roomId,
      authorId: m.authorId,
      content: m.content,
      createdAt: m.createdAt.toISOString()
    };
    emitChatNewMessage(id, payload);
    res.status(201).json(m);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

router.delete('/chat/rooms/:id', requireAuth, requireRole(['client', 'psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const allowed = await userCanAccessChatRoom(req.user!, id);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    await prisma.chatMessage.deleteMany({ where: { roomId: id } });
    await prisma.chatRoom.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete room' });
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
    
    // Берем тот же набор доступных комнат, что и в основном списке чатов.
    const rooms = await getVisibleRoomsForUser(req.user!);
    
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

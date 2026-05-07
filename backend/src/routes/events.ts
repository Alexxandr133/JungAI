import { Router } from 'express';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { randomBytes } from 'crypto';
import { notifyEventDeleted } from '../websocket/voiceRoom';
import { io } from '../server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config';

const router = Router();

// Agora App ID и App Certificate
const AGORA_APP_ID = config.agoraAppId;
const AGORA_APP_CERTIFICATE = config.agoraAppCertificate;

// Функция для генерации уникального ID комнаты
function generateRoomId(): string {
  return randomBytes(16).toString('hex');
}

// Функция для генерации URL комнаты
function generateRoomUrl(roomId: string): string {
  return `${config.frontendUrl}/room/${roomId}`;
}

function parseEventDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // datetime-local приходит без таймзоны: 2026-05-07T18:00
  // На проде (UTC) это нельзя парсить через new Date(raw), иначе будет сдвиг.
  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    const year = Number(y);
    const month = Number(m) - 1;
    const day = Number(d);
    const hour = Number(hh);
    const minute = Number(mm);
    const second = Number(ss || '0');
    const utcMs = Date.UTC(year, month, day, hour, minute, second) - (config.eventTimezoneOffsetMinutes * 60 * 1000);
    const result = new Date(utcMs);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function isGuestAccessibleType(eventType: string | null | undefined): boolean {
  return eventType === 'video' || eventType === 'call';
}

async function canUserAccessEvent(event: any, user: { id: string; role: string; email: string }): Promise<boolean> {
  if (!event) return false;
  if (user.role === 'admin') return true;
  if (event.createdBy === user.id) return true;
  if (event.type !== 'session') return true;
  const eventClientId = (event as any).clientId as string | null | undefined;
  if (!eventClientId) return false;
  const client = await prisma.client.findUnique({
    where: { id: eventClientId },
    select: { id: true, psychologistId: true, email: true }
  });
  if (!client) return false;
  if (client.psychologistId === user.id) return true;
  return Boolean(client.email && user.email && client.email.toLowerCase() === user.email.toLowerCase());
}

router.get('/events', requireAuth, async (req: AuthedRequest, res) => {
  const where: any = {};
  if (req.user?.role === 'psychologist' || req.user?.role === 'researcher') {
    where.createdBy = req.user.id;
  }
  const items = await prisma.event.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    include: {
      voiceRoom: true
    }
  });
  res.json({ items });
});

router.post('/events', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { title, type, description, startsAt, endsAt, clientId } = req.body ?? {};
  const parsedStartsAt = parseEventDateInput(startsAt);
  const parsedEndsAt = endsAt ? parseEventDateInput(endsAt) : null;
  if (!parsedStartsAt) {
    return res.status(400).json({ error: 'Invalid startsAt format' });
  }
  if (endsAt && !parsedEndsAt) {
    return res.status(400).json({ error: 'Invalid endsAt format' });
  }
  
  // Если это сессия с клиентом, проверяем клиента заранее
  let client = null;
  if (type === 'session' && clientId) {
    client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  
  // Генерируем данные для голосовой комнаты
  const roomId = generateRoomId();
  const roomUrl = generateRoomUrl(roomId);
  
  // Создаем событие с голосовой комнатой
  const event = await prisma.event.create({ 
    data: { 
      title, 
      type, 
      description, 
      startsAt: parsedStartsAt,
      endsAt: parsedEndsAt,
      createdBy: req.user!.id,
      clientId: type === 'session' ? clientId : null,
      sessionStatus: type === 'session' && clientId ? 'pending' : null,
      voiceRoom: {
        create: {
          roomId,
          roomUrl
        }
      }
    } as any,
    include: {
      voiceRoom: true
    }
  });

  // Если это сессия с клиентом, создаем TherapySession и уведомление
  if (type === 'session' && clientId && client) {
    try {
      // Создаем сессию
      await prisma.therapySession.create({
        data: {
          clientId: clientId,
          date: parsedStartsAt,
          summary: description || title,
          videoUrl: null,
          eventId: event.id
        }
      });

      // Получаем информацию о психологе для уведомления
      const psychologist = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { profile: true }
      });

      const psychologistName = psychologist?.profile?.name || psychologist?.email || 'Психолог';

      // Создаем уведомление для клиента
      // Находим User ID клиента по email (если клиент зарегистрирован)
      try {
        if (client.email) {
          const clientUser = await prisma.user.findFirst({
            where: { email: client.email }
          });
          
          if (clientUser) {
            await (prisma as any).notification.create({
              data: {
                userId: clientUser.id,
                type: 'session_invitation',
                title: 'Приглашение на сессию',
                message: `${psychologistName} приглашает вас на сессию "${title}" ${parsedStartsAt.toLocaleString('ru-RU', { timeZone: config.appTimeZone })}`,
                entityType: 'event',
                entityId: event.id,
                read: false
              }
            });
          } else {
            // Клиент еще не зарегистрирован, уведомление будет создано при регистрации или показано на странице сессий
            console.log(`Client ${client.email} is not registered yet, notification will be shown on sessions page`);
          }
        }
      } catch (notifError: any) {
        console.error('Failed to create notification:', notifError);
        // Не прерываем создание события, если не удалось создать уведомление
      }
    } catch (error: any) {
      console.error('Failed to create therapy session:', error);
      // Не прерываем создание события, если не удалось создать сессию
    }
  }

  res.status(201).json(event);
});

// Начать сессию раньше (только для создателя события)
router.post('/events/:id/start-early', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);

  try {
    const event = await prisma.event.findUnique({ 
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Проверяем, что пользователь является создателем события
    if (event.createdBy !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only event creator can start the session early' });
    }

    // Проверяем, что сессия еще не началась по расписанию
    const now = new Date();
    const scheduledStart = new Date(event.startsAt);
    
    if (now >= scheduledStart) {
      return res.status(400).json({ error: 'Session has already started or passed' });
    }

    // Устанавливаем фактическое время начала
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        actualStartTime: now
      } as any,
      include: {
        voiceRoom: true
      }
    });

    res.json(updatedEvent);
  } catch (e: any) {
    console.error('Error starting session early:', e);
    res.status(500).json({ error: e.message || 'Failed to start session early' });
  }
});

// Принять или отклонить сессию (для клиентов)
router.put('/events/:id/session-status', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { status, comment } = req.body ?? {}; // status: 'accepted' | 'declined', comment: string (опционально)

  if (!status || !['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be "accepted" or "declined"' });
  }

  try {
    const event = await prisma.event.findUnique({ 
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Проверяем, что это сессия
    if (event.type !== 'session') {
      return res.status(400).json({ error: 'This event is not a session' });
    }

    // Проверяем, что у события есть clientId
    const eventWithClientId = event as typeof event & { clientId?: string | null };
    if (!eventWithClientId.clientId) {
      return res.status(400).json({ error: 'This session has no client assigned' });
    }

    // Проверяем права доступа: клиент может изменять только свои сессии
    // Для клиентов используем clientId как идентификатор
    // В реальной системе нужно проверить связь между req.user и clientId
    // Пока разрешаем изменение, если пользователь имеет доступ

    // Обновляем статус сессии
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        sessionStatus: status,
        sessionDeclineComment: status === 'declined' ? (comment || null) : null
      } as any,
      include: {
        voiceRoom: true
      }
    });

    // Создаем уведомление для психолога о решении клиента
    try {
      const client = await prisma.client.findUnique({ where: { id: eventWithClientId.clientId } });
      if (client) {
        await (prisma as any).notification.create({
          data: {
            userId: client.psychologistId,
            type: status === 'accepted' ? 'session_accepted' : 'session_declined',
            title: status === 'accepted' ? 'Сессия принята' : 'Сессия отклонена',
            message: status === 'accepted' 
              ? `Клиент ${client.name} принял приглашение на сессию "${event.title}"`
              : `Клиент ${client.name} отклонил приглашение на сессию "${event.title}"${comment ? `: ${comment}` : ''}`,
            entityType: 'event',
            entityId: event.id,
            read: false
          }
        });
      }
    } catch (notifError: any) {
      console.error('Failed to create notification for psychologist:', notifError);
    }

    res.json(updatedEvent);
  } catch (e: any) {
    console.error('Error updating session status:', e);
    res.status(500).json({ error: e.message || 'Failed to update session status' });
  }
});

// Получить событие по roomId
router.get('/events/by-room/:roomId', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId);
  
  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: {
        event: true
      }
    });

    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }

    const allowed = await canUserAccessEvent(voiceRoom.event as any, req.user!);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    res.json({ event: voiceRoom.event, voiceRoom });
  } catch (e: any) {
    console.error('Error getting event by roomId:', e);
    res.status(500).json({ error: e.message || 'Failed to get event' });
  }
});

router.get('/events/public-room/:roomId', async (req, res) => {
  const roomId = String(req.params.roomId || '');
  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }
    if (!isGuestAccessibleType((voiceRoom.event as any).type)) {
      return res.status(403).json({ error: 'Guest access is allowed only for video meetings' });
    }
    res.json({
      event: voiceRoom.event,
      voiceRoom
    });
  } catch (e: any) {
    console.error('Error getting public event by roomId:', e);
    res.status(500).json({ error: e.message || 'Failed to get event' });
  }
});

router.get('/events/room/:roomId/livekit-token', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId || '');
  try {
    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      return res.status(500).json({ error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' });
    }

    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }

    const allowed = await canUserAccessEvent(voiceRoom.event as any, req.user!);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const identity = req.user!.id;
    const profile = await (prisma as any).profile.findUnique({
      where: { userId: identity },
      select: { name: true, avatarUrl: true }
    });
    const displayName = profile?.name || req.user!.email || `user-${identity.slice(0, 8)}`;
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity,
      name: displayName,
      metadata: JSON.stringify({
        userId: identity,
        displayName,
        avatarUrl: profile?.avatarUrl || null
      }),
      ttl: `${Math.max(300, config.livekitTokenTtlSec)}s`
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    const token = await at.toJwt();
    res.json({
      token,
      url: config.livekitUrl,
      roomName: roomId,
      identity,
      name: displayName
    });
  } catch (e: any) {
    console.error('Error generating LiveKit token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate LiveKit token' });
  }
});

router.post('/events/room/:roomId/guest-livekit-token', async (req, res) => {
  const roomId = String(req.params.roomId || '');
  const requestedName = String(req.body?.displayName || '').trim();
  const displayName = requestedName.slice(0, 60) || 'Гость';

  try {
    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      return res.status(500).json({ error: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' });
    }

    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });
    if (!voiceRoom || !voiceRoom.event) {
      return res.status(404).json({ error: 'Room or event not found' });
    }
    if (!isGuestAccessibleType((voiceRoom.event as any).type)) {
      return res.status(403).json({ error: 'Guest access is allowed only for video meetings' });
    }

    const identity = `guest-${randomBytes(8).toString('hex')}`;
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity,
      name: displayName,
      metadata: JSON.stringify({
        isGuest: true,
        displayName
      }),
      ttl: `${Math.max(300, config.livekitTokenTtlSec)}s`
    });
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    const token = await at.toJwt();
    res.json({
      token,
      url: config.livekitUrl,
      roomName: roomId,
      identity,
      name: displayName
    });
  } catch (e: any) {
    console.error('Error generating guest LiveKit token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate guest LiveKit token' });
  }
});

// Генерация токена Agora по roomId
router.get('/events/room/:roomId/agora-token', requireAuth, async (req: AuthedRequest, res) => {
  const roomId = String(req.params.roomId);
  const { uid } = req.query;

  try {
    const voiceRoom = await prisma.voiceRoom.findUnique({
      where: { roomId },
      include: { event: true }
    });

    if (!voiceRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const channelName = roomId;
    const userId = uid ? parseInt(uid as string, 10) : getUid(req.user!.id);

    // Если App Certificate не настроен, проверяем временный токен
    if (!AGORA_APP_CERTIFICATE) {
      const tempToken = config.agoraTempToken;
      if (tempToken) {
        // Используем временный токен из консоли Agora
        console.log('Using temporary Agora token from environment');
        return res.json({ token: tempToken, appId: AGORA_APP_ID, channel: channelName, uid: userId });
      }
      
      console.warn('AGORA_APP_CERTIFICATE not set. Token generation will fail.');
      return res.status(500).json({ 
        error: 'Agora App Certificate not configured. Please set AGORA_APP_CERTIFICATE in .env file or use temporary token from Agora console.',
        hint: 'You can generate a temporary token at: https://console.agora.io/projects > Your Project > Edit > Features > Generate temp token. Then set AGORA_TEMP_TOKEN in .env'
      });
    }

    // Генерируем токен (действителен 24 часа)
    // ВАЖНО: токен должен быть сгенерирован с правильным именем канала (channelName)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);
    const role = RtcRole.PUBLISHER; // Пользователь может публиковать аудио

    let token: string;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName, // КРИТИЧЕСКИ ВАЖНО: правильное имя канала!
        userId,
        role,
        expirationTimeInSeconds,
        expirationTimeInSeconds // privilegeExpire
      );
    } catch (tokenError: any) {
      console.error('Error building Agora token:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to generate Agora token',
        details: tokenError.message 
      });
    }

    console.log(`Generated Agora token for channel: ${channelName}, uid: ${userId}`);
    res.json({ token, appId: AGORA_APP_ID, channel: channelName, uid: userId });
  } catch (e: any) {
    console.error('Error generating Agora token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate token' });
  }
});

// Генерация токена Agora для подключения к голосовой комнате (по event ID)
router.get('/events/:id/agora-token', requireAuth, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const { channel, uid } = req.query;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { voiceRoom: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Используем roomId как channel - ВАЖНО: токен должен быть сгенерирован с правильным именем канала!
    const channelName = (channel as string) || event.voiceRoom?.roomId || 'default';
    const userId = uid ? parseInt(uid as string, 10) : getUid(req.user!.id);

    // Если App Certificate не настроен, проверяем временный токен
    if (!AGORA_APP_CERTIFICATE) {
      const tempToken = config.agoraTempToken;
      if (tempToken) {
        // Используем временный токен из консоли Agora
        console.log('Using temporary Agora token from environment');
        return res.json({ token: tempToken, appId: AGORA_APP_ID, channel: channelName, uid: userId });
      }
      
      console.warn('AGORA_APP_CERTIFICATE not set. Token generation will fail.');
      return res.status(500).json({ 
        error: 'Agora App Certificate not configured. Please set AGORA_APP_CERTIFICATE in .env file or use temporary token from Agora console.',
        hint: 'You can generate a temporary token at: https://console.agora.io/projects > Your Project > Edit > Features > Generate temp token. Then set AGORA_TEMP_TOKEN in .env'
      });
    }

    // Генерируем токен (действителен 24 часа)
    // ВАЖНО: токен должен быть сгенерирован с правильным именем канала (channelName)
    const expirationTimeInSeconds = Math.floor(Date.now() / 1000) + (24 * 3600);
    const role = RtcRole.PUBLISHER; // Пользователь может публиковать аудио

    let token: string;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName, // КРИТИЧЕСКИ ВАЖНО: правильное имя канала!
        userId,
        role,
        expirationTimeInSeconds,
        expirationTimeInSeconds // privilegeExpire
      );
    } catch (tokenError: any) {
      console.error('Error building Agora token:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to generate Agora token',
        details: tokenError.message 
      });
    }

    console.log(`Generated Agora token for channel: ${channelName}, uid: ${userId}`);
    res.json({ token, appId: AGORA_APP_ID, channel: channelName, uid: userId });
  } catch (e: any) {
    console.error('Error generating Agora token:', e);
    res.status(500).json({ error: e.message || 'Failed to generate token' });
  }
});

// Вспомогательная функция для преобразования строкового ID в число
function getUid(id: string): number {
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) return numId;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

router.delete('/events/:id', requireAuth, requireRole(['psychologist', 'researcher', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  try {
    // Получаем событие перед удалением
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Если это сессия с клиентом, нужно найти и удалить соответствующую TherapySession
    const eventWithClientId = event as typeof event & { clientId?: string | null };
    if (eventWithClientId.type === 'session' && eventWithClientId.clientId) {
      try {
        // Проверяем, что клиент принадлежит психологу (для безопасности)
        const client = await prisma.client.findUnique({ where: { id: eventWithClientId.clientId } });
        if (client && (req.user!.role === 'admin' || client.psychologistId === req.user!.id)) {
          // Ищем TherapySession по clientId и дате (с небольшой погрешностью в 1 минуту)
          const eventDate = new Date(eventWithClientId.startsAt);
          const oneMinute = 60 * 1000; // 1 минута в миллисекундах

          const sessions = await prisma.therapySession.findMany({
            where: {
              clientId: eventWithClientId.clientId,
              date: {
                gte: new Date(eventDate.getTime() - oneMinute),
                lte: new Date(eventDate.getTime() + oneMinute)
              }
            }
          });

          // Удаляем найденные сессии
          for (const session of sessions) {
            await prisma.therapySession.delete({ where: { id: session.id } });
          }
        }
      } catch (error: any) {
        console.error('Failed to delete therapy session:', error);
        // Продолжаем удаление события даже если не удалось удалить сессию
      }
    }

    // Получаем roomId перед удалением для уведомления
    const eventWithRoom = await prisma.event.findUnique({
      where: { id },
      include: { voiceRoom: true }
    });
    
    const roomId = eventWithRoom?.voiceRoom?.roomId;
    
    // Удаляем событие
    await prisma.event.delete({ where: { id } });
    
    // Уведомляем всех участников комнаты об удалении события
    if (roomId) {
      notifyEventDeleted(io, roomId);
    }
    
    res.status(204).end();
  } catch (e) {
    console.error('Error deleting event:', e);
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;

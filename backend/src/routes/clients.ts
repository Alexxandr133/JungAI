import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { getUploadsRoot } from '../utils/uploadsRoot';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Настройка multer для загрузки аватаров клиентов
const uploadsBaseDir = getUploadsRoot();
const avatarsDir = path.join(uploadsBaseDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-client-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла. Разрешены: JPG, PNG'));
    }
  }
});

// Получить психолога клиента
router.get('/clients/my-psychologist', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, psychologistId: true, therapyEndedAt: true }
    });
    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'NO_CLIENT_PROFILE' });
    }

    if (!client.psychologistId || client.psychologistId.startsWith('temp-')) {
      return res.status(404).json({ error: 'Psychologist is not selected yet', code: 'NO_PSYCHOLOGIST' });
    }
    if (client.therapyEndedAt) {
      return res.status(404).json({ error: 'Therapy with psychologist has ended', code: 'THERAPY_ENDED' });
    }

    const psychologist = await prisma.user.findFirst({
      where: { id: client.psychologistId, role: { in: ['psychologist', 'admin'] } },
      include: {
        profile: {
          select: {
            name: true,
            avatarUrl: true,
            bio: true,
            specialization: true
          }
        }
      }
    });
    if (!psychologist) {
      return res.status(404).json({ error: 'Psychologist not found', code: 'NO_PSYCHOLOGIST' });
    }

    return res.json({
      id: psychologist.id,
      email: psychologist.email,
      name: psychologist.profile?.name || psychologist.email.split('@')[0],
      avatarUrl: psychologist.profile?.avatarUrl || null,
      bio: psychologist.profile?.bio || null,
      specialization: psychologist.profile?.specialization || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get psychologist' });
  }
});

// Получить сессии клиента
router.get('/my-sessions', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    
    const sessions = await prisma.therapySession.findMany({
      where: { clientId: client.id },
      orderBy: { date: 'desc' }
    });
    
    res.json({ items: sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

// Получить события-сессии для клиента
router.get('/my-events', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true }
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    
    const events = await prisma.event.findMany({
      where: { 
        clientId: client.id,
        type: 'session'
      },
      include: {
        voiceRoom: true
      },
      orderBy: { startsAt: 'desc' }
    });
    
    res.json({ items: events });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get events' });
  }
});

// Клиенты психолога
router.get('/clients', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    // КРИТИЧНО: Проверяем, что пользователь авторизован
    if (!req.user || !req.user.id) {
      console.error('[GET /clients] No user in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ для диагностики
    console.log(`[GET /clients] ===== REQUEST START =====`);
    console.log(`[GET /clients] User ID: ${req.user.id}`);
    console.log(`[GET /clients] User Email: ${req.user.email}`);
    console.log(`[GET /clients] User Role: ${req.user.role}`);
    console.log(`[GET /clients] Authorization Header: ${req.headers.authorization?.substring(0, 50)}...`);

    const status = String(req.query.status || 'active').toLowerCase();
    const isArchivedView = status === 'archived' || status === 'archive';
    const therapyFilter = isArchivedView
      ? { therapyEndedAt: { not: null } }
      : { therapyEndedAt: null };

    // КРИТИЧНО: Для психологов - ТОЛЬКО свои клиенты, для админов - всех
    let whereClause: any = {};

    if (req.user.role === 'psychologist') {
      // СТРОГАЯ ФИЛЬТРАЦИЯ: только клиенты этого психолога
      whereClause = {
        psychologistId: req.user.id,
        ...therapyFilter
      };
      console.log(`[GET /clients] Filtering for psychologist ${req.user.id} with whereClause:`, JSON.stringify(whereClause));
    } else if (req.user.role === 'admin') {
      // Prisma 6: not: { startsWith } недопустим — исключаем temp- через NOT
      whereClause = {
        AND: [
          { psychologistId: { not: null } },
          { psychologistId: { not: '' } },
          { NOT: { psychologistId: { startsWith: 'temp-' } } },
          therapyFilter
        ]
      };
      console.log(`[GET /clients] Admin access - showing all clients (excluding null/temp)`);
    } else {
      console.error(`[GET /clients] Invalid role: ${req.user.role}`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Получаем клиентов с правильной фильтрацией
    const clients = await prisma.client.findMany({ 
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        age: true,
        city: true,
        tags: true,
        therapyEndedAt: true,
        psychologistId: true,
        createdAt: true,
        registrationToken: true,
        tokenExpiresAt: true
      },
      orderBy: { createdAt: 'desc' } 
    });

    console.log(`[GET /clients] Found ${clients.length} clients from database`);
    
    // ЛОГИРУЕМ psychologistId каждого клиента для диагностики
    if (clients.length > 0) {
      console.log(`[GET /clients] Client psychologistIds:`, clients.map(c => ({ id: c.id, name: c.name, psychologistId: c.psychologistId })));
    }

    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА БЕЗОПАСНОСТИ: Для психологов еще раз фильтруем на всякий случай
    // Также исключаем временные записи (temp-*) и null/пустые значения
    let filteredClients = clients;
    if (req.user.role === 'psychologist') {
      const beforeCount = filteredClients.length;
      filteredClients = clients.filter(client => {
        // КРИТИЧНО: Проверяем, что клиент принадлежит этому психологу
        const matches = client.psychologistId === req.user!.id;
        // Также исключаем временные записи
        const notTemp = client.psychologistId && !client.psychologistId.startsWith('temp-');
        const notEmpty = client.psychologistId && client.psychologistId.trim() !== '';
        
        if (!matches) {
          console.error(`[GET /clients] SECURITY: Client ${client.id} (${client.name}) has psychologistId=${client.psychologistId}, expected ${req.user!.id}`);
        }
        
        return matches && notTemp && notEmpty;
      });
      
      if (filteredClients.length !== beforeCount) {
        console.error(`[GET /clients] SECURITY WARNING: Filtered ${beforeCount} to ${filteredClients.length} clients for psychologist ${req.user.id}`);
        console.error(`[GET /clients] This indicates a database integrity issue or query problem!`);
      }
    } else if (req.user.role === 'admin') {
      filteredClients = clients.filter((client) => {
        const pid = client.psychologistId;
        return pid != null && pid.trim() !== '' && !pid.startsWith('temp-');
      });
    }
    
    console.log(`[GET /clients] Returning ${filteredClients.length} clients after security filter`);
    
    // Используем Set для удаления дубликатов по email
    const uniqueClients = new Map();
    for (const client of filteredClients) {
      if (client.email && !uniqueClients.has(client.email)) {
        uniqueClients.set(client.email, client);
      } else if (!client.email && !uniqueClients.has(client.id)) {
        uniqueClients.set(client.id, client);
      }
    }
    
    console.log(`[GET /clients] After deduplication: ${uniqueClients.size} unique clients`);

    const deduped = Array.from(uniqueClients.values()) as Array<{
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      age?: number | null;
      city?: string | null;
      tags?: unknown;
      therapyEndedAt?: Date | null;
      psychologistId: string;
      createdAt: Date;
      registrationToken?: string | null;
      tokenExpiresAt?: Date | null;
    }>;
    const clientIds = deduped.map((c) => c.id);
    const now = new Date();

    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const filterRaw = typeof req.query.filter === 'string' ? req.query.filter.trim().toLowerCase() : '';
    const tagRaw = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
    const tagsRaw = typeof req.query.tags === 'string' ? req.query.tags : '';
    const tagFilters = [
      ...(tagRaw ? [tagRaw] : []),
      ...tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ];

    const [upcomingEvents, recentSessions, recentNotes, openTasks] = await Promise.all([
      clientIds.length
        ? prisma.event.findMany({
            where: {
              clientId: { in: clientIds },
              startsAt: { gte: now },
              OR: [{ sessionStatus: null }, { sessionStatus: { in: ['accepted', 'pending'] } }],
            },
            orderBy: { startsAt: 'asc' },
            select: { id: true, clientId: true, startsAt: true, title: true, sessionStatus: true },
          })
        : Promise.resolve([]),
      clientIds.length
        ? prisma.therapySession.findMany({
            where: { clientId: { in: clientIds } },
            orderBy: { date: 'desc' },
            select: { clientId: true, date: true },
          })
        : Promise.resolve([]),
      clientIds.length
        ? prisma.clientNote.findMany({
            where: { clientId: { in: clientIds } },
            orderBy: { createdAt: 'desc' },
            select: { clientId: true, createdAt: true },
          })
        : Promise.resolve([]),
      clientIds.length
        ? prisma.task.findMany({
            where: {
              clientId: { in: clientIds },
              ownerId: req.user.id,
              status: { not: 'done' },
            },
            select: { clientId: true },
          })
        : Promise.resolve([]),
    ]);

    const nextByClient = new Map<string, { id: string; startsAt: Date; title: string }>();
    for (const ev of upcomingEvents) {
      if (!ev.clientId) continue;
      if (!nextByClient.has(ev.clientId)) {
        nextByClient.set(ev.clientId, { id: ev.id, startsAt: ev.startsAt, title: ev.title });
      }
    }

    const lastSessionByClient = new Map<string, Date>();
    for (const s of recentSessions) {
      if (!lastSessionByClient.has(s.clientId)) lastSessionByClient.set(s.clientId, s.date);
    }
    const lastNoteByClient = new Map<string, Date>();
    for (const n of recentNotes) {
      if (!lastNoteByClient.has(n.clientId)) lastNoteByClient.set(n.clientId, n.createdAt);
    }
    const openTasksByClient = new Map<string, number>();
    for (const t of openTasks) {
      if (!t.clientId) continue;
      openTasksByClient.set(t.clientId, (openTasksByClient.get(t.clientId) || 0) + 1);
    }

    function registrationStatusFor(client: {
      therapyEndedAt?: Date | null;
      registrationToken?: string | null;
      tokenExpiresAt?: Date | null;
      platformRegistered?: boolean;
    }): 'registered' | 'pending' | 'expired' | 'archived' {
      if (client.therapyEndedAt) return 'archived';
      if (client.platformRegistered) return 'registered';
      if (client.registrationToken) {
        const exp = client.tokenExpiresAt ? client.tokenExpiresAt.getTime() : NaN;
        if (Number.isFinite(exp) && exp < Date.now()) return 'expired';
        return 'pending';
      }
      return 'registered';
    }

    // Обогащаем клиентов данными профиля + CRM meta
    let items = await Promise.all(
      deduped.map(async (client) => {
        let profile = null as any;
        let avatarUrl = null as string | null;
        let platformRegistered = false;
        let regTok = client.registrationToken as string | null | undefined;
        if (client.email) {
          const emailNorm = String(client.email).trim().toLowerCase();
          const user =
            (await prisma.user.findFirst({
              where: { email: emailNorm },
              include: { profile: true },
            })) ||
            (emailNorm !== client.email
              ? await prisma.user.findFirst({
                  where: { email: client.email },
                  include: { profile: true },
                })
              : null);
          profile = user?.profile || null;
          avatarUrl = user?.profile?.avatarUrl || null;
          platformRegistered = Boolean(user);
          if (platformRegistered && regTok) {
            await prisma.client.update({
              where: { id: client.id },
              data: { registrationToken: null, tokenExpiresAt: null },
            });
            regTok = null;
          }
        }

        const next = nextByClient.get(client.id);
        const lastSession = lastSessionByClient.get(client.id);
        const lastNote = lastNoteByClient.get(client.id);
        let lastContactAt: Date | null = null;
        for (const d of [lastSession, lastNote, client.createdAt]) {
          if (!d) continue;
          if (!lastContactAt || d > lastContactAt) lastContactAt = d;
        }

        const registrationStatus = registrationStatusFor({
          therapyEndedAt: client.therapyEndedAt,
          registrationToken: regTok,
          tokenExpiresAt: client.tokenExpiresAt,
          platformRegistered,
        });

        return {
          ...client,
          profile,
          avatarUrl,
          registrationPending: Boolean(regTok) && !platformRegistered,
          registrationToken: platformRegistered ? null : (regTok ?? null),
          platformRegistered,
          registrationStatus,
          nextSessionAt: next?.startsAt ?? null,
          nextSessionId: next?.id ?? null,
          nextSessionTitle: next?.title ?? null,
          lastContactAt,
          openTasksCount: openTasksByClient.get(client.id) || 0,
        };
      })
    );

    if (qRaw) {
      items = items.filter((c) => {
        const hay = [c.name, c.email, c.phone, c.city]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const tagHay = Array.isArray(c.tags)
          ? (c.tags as Array<{ label?: string }>).map((t) => String(t?.label || '').toLowerCase()).join(' ')
          : '';
        return hay.includes(qRaw) || tagHay.includes(qRaw);
      });
    }

    if (tagFilters.length) {
      items = items.filter((c) => {
        const labels = Array.isArray(c.tags)
          ? (c.tags as Array<{ label?: string }>).map((t) => String(t?.label || '').toLowerCase())
          : [];
        return tagFilters.some((t) => labels.includes(t));
      });
    }

    if (filterRaw === 'needs_attention') {
      items = items.filter(
        (c) =>
          c.registrationStatus === 'expired' ||
          (!c.nextSessionAt && !c.therapyEndedAt) ||
          c.openTasksCount > 0
      );
    } else if (filterRaw === 'no_upcoming') {
      items = items.filter((c) => !c.nextSessionAt && !c.therapyEndedAt);
    } else if (filterRaw === 'expired_invite') {
      items = items.filter((c) => c.registrationStatus === 'expired');
    } else if (filterRaw === 'has_tasks') {
      items = items.filter((c) => c.openTasksCount > 0);
    }

    console.log(`[GET /clients] ===== REQUEST END: Returning ${items.length} items =====`);

    res.json({ items });
  } catch (error: any) {
    console.error('[GET /clients] Error:', error);
    console.error('[GET /clients] Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to get clients' });
  }
});

router.post('/clients', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { name, email, phone, age, city, tags } = req.body ?? {};

  const nameTrim = String(name ?? '').trim();
  const emailNorm = String(email ?? '').trim().toLowerCase();
  if (!nameTrim) {
    return res.status(400).json({ error: 'Укажите имя клиента' });
  }
  if (!EMAIL_REGEX.test(emailNorm)) {
    return res.status(400).json({ error: 'Укажите корректный email — клиент войдёт в аккаунт по этой почте' });
  }

  // Генерируем токен регистрации
  const crypto = require('crypto');
  const registrationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Токен действителен 7 дней

  const c = await prisma.client.create({
    data: {
      name: nameTrim,
      email: emailNorm,
      phone: phone ? String(phone).trim() : undefined,
      age: age != null && age !== '' ? parseInt(String(age), 10) : undefined,
      city: city ? String(city).trim() : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      psychologistId: req.user!.id,
      registrationToken,
      tokenExpiresAt
    }
  });

  res.status(201).json({
    ...c,
    registrationToken,
    registrationPending: true,
  });
});

// Получить клиента по ID (для админа - любой клиент, для психолога - только свой)
router.get('/clients/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        age: true,
        city: true,
        tags: true,
        therapyEndedAt: true,
        psychologistId: true,
        createdAt: true,
        registrationToken: true,
        tokenExpiresAt: true
      }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Если не админ, проверяем, что клиент принадлежит текущему психологу
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Получаем профиль клиента
    const emailNorm = String(client.email || '').trim().toLowerCase();
    const user = emailNorm
      ? (await prisma.user.findFirst({
          where: { email: emailNorm },
          include: { profile: true },
        })) ||
        (emailNorm !== client.email
          ? await prisma.user.findFirst({
              where: { email: client.email || '' },
              include: { profile: true },
            })
          : null)
      : null;

    let regTok = client.registrationToken;
    if (user && regTok) {
      await prisma.client.update({
        where: { id: client.id },
        data: { registrationToken: null, tokenExpiresAt: null },
      });
      regTok = null;
    }
    const { registrationToken: _reg, ...clientSafe } = client as any;

    let lastMoodCheckIn: {
      mood: number;
      energy: number;
      anxiety: number;
      note: string | null;
      createdAt: Date;
    } | null = null;
    try {
      lastMoodCheckIn = await (prisma as any).moodCheckIn.findFirst({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        select: { mood: true, energy: true, anxiety: true, note: true, createdAt: true },
      });
    } catch {
      lastMoodCheckIn = null;
    }

    const discussDreams = await (prisma as any).dream.findMany({
      where: { clientId: id, discussOnSession: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, createdAt: true, discussOnSession: true },
    });

    res.json({
      ...clientSafe,
      profile: user?.profile || null,
      userId: user?.id || null,
      avatarUrl: user?.profile?.avatarUrl || null,
      registrationPending: Boolean(regTok) && !user,
      registrationToken: user ? null : (regTok ?? null),
      platformRegistered: Boolean(user),
      lastMoodCheckIn,
      discussOnSessionDreams: discussDreams,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get client' });
  }
});

// Получить профиль клиента (для самого клиента)
router.get('/client/profile', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    console.log(`[GET /client/profile] Request from user: ${req.user!.id} (${req.user!.email}), role: ${req.user!.role}`);
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      console.log(`[GET /client/profile] Client not found for email: ${req.user!.email}`);
      return res.status(404).json({ error: 'Client not found' });
    }
    
    console.log(`[GET /client/profile] Client found: id=${client.id}, name="${client.name}"`);
    
    const user = await prisma.user.findFirst({
      where: { email: req.user!.email },
      include: {
        profile: true
      }
    });
    
    console.log(`[GET /client/profile] User profile: name="${user?.profile?.name || 'null'}"`);
    console.log(`[GET /client/profile] Returning: client.name="${client.name}", profile.name="${user?.profile?.name || 'null'}"`);
    
    res.json({
      client,
      profile: user?.profile || null
    });
  } catch (error: any) {
    console.error(`[GET /client/profile] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to get profile' });
  }
});

// Удалить аккаунт клиента (самостоятельно)
router.delete('/client/account', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    // Находим клиента
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const clientId = client.id;
    const userId = req.user!.id;
    
    // Удаляем все связанные данные клиента
    await prisma.clientNote.deleteMany({ where: { clientId } });
    await prisma.therapySession.deleteMany({ where: { clientId } });
    await prisma.journalEntry.deleteMany({ where: { clientId } });
    await prisma.dream.deleteMany({ where: { clientId } });
    await prisma.testResult.deleteMany({ where: { clientId } });
    // Удаляем DocumentVersion перед удалением ClientDocument
    const documents = await prisma.clientDocument.findMany({ where: { clientId }, select: { id: true } });
    for (const doc of documents) {
      await prisma.documentVersion.deleteMany({ where: { documentId: doc.id } });
    }
    await prisma.clientDocument.deleteMany({ where: { clientId } });
    await prisma.documentVersion.deleteMany({ where: { clientId } });
    await prisma.supportRequest.deleteMany({ where: { clientId } });
    await prisma.clientTabs.deleteMany({ where: { clientId } });
    
    // Удаляем профиль пользователя
    await prisma.profile.deleteMany({ where: { userId } });
    
    // Удаляем клиента
    await prisma.client.delete({ where: { id: clientId } });
    
    // Удаляем пользователя
    await prisma.user.delete({ where: { id: userId } });
    
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

// Сохранить профиль клиента
router.post('/client/profile', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const { name, email, phone, age, gender, bio } = req.body ?? {};
    
    // Обновляем клиента (чтобы психолог видел изменения)
    await prisma.client.update({
      where: { id: client.id },
      data: {
        name: name !== undefined ? name : client.name,
        email: email !== undefined ? email : client.email,
        phone: phone !== undefined ? phone : client.phone
      }
    });
    
    // Обновляем или создаём профиль
    const user = await prisma.user.findFirst({
      where: { email: req.user!.email }
    });
    
    if (user) {
      await prisma.profile.upsert({
        where: { userId: user.id },
        update: {
          name: name !== undefined ? name : undefined,
          age: age ? parseInt(age) : undefined,
          gender: gender !== undefined ? gender : undefined,
          bio: bio !== undefined ? bio : undefined,
          interests: []
        },
        create: {
          userId: user.id,
          name: name || undefined,
          age: age ? parseInt(age) : undefined,
          gender: gender || undefined,
          bio: bio || undefined,
          interests: []
        }
      });

      // Создаем уведомление для психолога
      if (client.psychologistId) {
        await (prisma as any).notification.create({
          data: {
            userId: client.psychologistId,
            type: 'profile_updated',
            title: 'Профиль клиента обновлен',
            message: `Клиент ${client.name || 'без имени'} обновил свой профиль`,
            entityType: 'client',
            entityId: client.id
          }
        });
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save profile' });
  }
});

// Загрузить аватар клиента
router.post('/client/profile/avatar', requireAuth, requireRole(['client', 'admin']), uploadAvatar.single('avatar'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const user = await prisma.user.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    });
    
    // Удаляем старый аватар, если есть
    if (profile?.avatarUrl) {
      const oldPath = path.join(uploadsBaseDir, profile.avatarUrl.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // Сохраняем относительный путь для URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: { avatarUrl },
      create: {
        userId: user.id,
        avatarUrl,
        interests: []
      }
    });

    // Создаем уведомление для психолога
    if (client.psychologistId) {
      await (prisma as any).notification.create({
        data: {
          userId: client.psychologistId,
          type: 'profile_updated',
          title: 'Фото профиля обновлено',
          message: `Клиент ${client.name || 'без имени'} обновил фото профиля`,
          entityType: 'client',
          entityId: client.id
        }
      });
    }
    
    res.json({ success: true, avatarUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to upload avatar' });
  }
});

// Обновить ссылку регистрации (если клиент ещё не зарегистрировался)
router.post('/clients/:id/refresh-registration-token', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existingUser = client.email
      ? await prisma.user.findFirst({ where: { email: client.email } })
      : null;
    if (existingUser) {
      return res.status(400).json({ error: 'Клиент уже зарегистрирован на платформе' });
    }

    const crypto = require('crypto');
    const registrationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: { registrationToken, tokenExpiresAt },
    });

    res.json({
      ok: true,
      registrationToken,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      registrationPending: true,
      client: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to refresh registration token' });
  }
});

// Завершить терапию (открепить клиента от психолога, данные сохраняются)
router.post('/clients/:id/end-therapy', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (client.therapyEndedAt) {
      return res.json({ ok: true, alreadyEnded: true });
    }
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: { therapyEndedAt: new Date() }
    });
    res.json({ ok: true, client: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to end therapy' });
  }
});

// Вернуть клиента из архива в активные
router.post('/clients/:id/restore-therapy', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await prisma.client.update({
      where: { id: client.id },
      data: { therapyEndedAt: null }
    });
    res.json({ ok: true, client: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to restore client' });
  }
});

// Обновить карточку клиента (без email и пароля)
router.patch('/clients/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, phone, age, city, tags, email, password } = req.body ?? {};
    if (email !== undefined || password !== undefined) {
      return res.status(400).json({ error: 'Email и пароль нельзя изменить через эту форму' });
    }

    const nameTrim = name != null ? String(name).trim() : undefined;
    if (nameTrim !== undefined && !nameTrim) {
      return res.status(400).json({ error: 'Имя не может быть пустым' });
    }

    const updated = await prisma.client.update({
      where: { id: client.id },
      data: {
        ...(nameTrim !== undefined ? { name: nameTrim } : {}),
        ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        ...(age !== undefined ? { age: age === '' || age == null ? null : parseInt(String(age), 10) } : {}),
        ...(city !== undefined ? { city: city ? String(city).trim() : null } : {}),
        ...(tags !== undefined
          ? { tags: Array.isArray(tags) ? tags : Prisma.JsonNull }
          : {})
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update client' });
  }
});

// Удаление клиента — только для admin (психолог использует end-therapy)
router.delete('/clients/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const clientId = req.params.id;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.user!.role === 'psychologist') {
    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { therapyEndedAt: client.therapyEndedAt ?? new Date() }
    });
    return res.json({ ok: true, ended: true, client: updated });
  }

  await prisma.clientNote.deleteMany({ where: { clientId } });
  await prisma.therapySession.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } });

  res.json({ ok: true });
});

// Сессии
router.get('/clients/:id/sessions', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const items = await (prisma as any).therapySession.findMany({
      where: { clientId: req.params.id },
      orderBy: { date: 'desc' }
    });
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

router.post('/clients/:id/sessions', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const { date, summary, videoUrl, eventId, topics, techniques, homework, nextFocus, moodBefore, moodAfter } = req.body ?? {};
    
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const s = await (prisma as any).therapySession.create({
      data: {
        clientId: req.params.id,
        date: new Date(date),
        summary,
        videoUrl,
        eventId: eventId || null,
        topics: topics ? (typeof topics === 'string' ? JSON.parse(topics) : topics) : null,
        techniques: techniques ? (typeof techniques === 'string' ? JSON.parse(techniques) : techniques) : null,
        homework: homework || null,
        nextFocus: nextFocus || null,
        moodBefore: moodBefore || null,
        moodAfter: moodAfter || null
      }
    });
    res.status(201).json(s);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

// Заметки
router.get('/clients/:id/notes', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const items = await prisma.clientNote.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load notes' });
  }
});

router.post('/clients/:id/notes', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const content = String(req.body?.content ?? '').trim();
    if (!content) return res.status(400).json({ error: 'Пустая заметка' });
    const n = await prisma.clientNote.create({
      data: { clientId: req.params.id, authorId: req.user!.id, content },
    });
    res.status(201).json(n);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create note' });
  }
});

router.delete('/clients/:id/notes/:noteId', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const note = await prisma.clientNote.findFirst({
      where: { id: req.params.noteId, clientId: req.params.id },
    });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    await prisma.clientNote.delete({ where: { id: note.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete note' });
  }
});

// CRM activity timeline
router.get('/clients/:id/activity', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const clientId = req.params.id;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = Math.min(80, Math.max(10, Number(req.query.limit) || 50));

    const [notes, sessions, documents, dreams, journal, clientTasks] = await Promise.all([
      prisma.clientNote.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.therapySession.findMany({
        where: { clientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.clientDocument.findMany({
        where: {
          clientId,
          ...(req.user!.role === 'admin' ? {} : { psychologistId: req.user!.id }),
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, tabName: true, updatedAt: true, content: true },
      }),
      prisma.dream.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, title: true, content: true, createdAt: true },
      }),
      prisma.journalEntry.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, content: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          clientId,
          ...(req.user!.role === 'admin' ? {} : { ownerId: req.user!.id }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, title: true, status: true, createdAt: true, dueAt: true },
      }),
    ]);

    const stripHtml = (s: string) =>
      String(s || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    type ActivityItem = {
      id: string;
      type: string;
      title: string;
      preview?: string | null;
      at: string;
      meta?: Record<string, unknown>;
    };

    const items: ActivityItem[] = [];

    for (const n of notes) {
      items.push({
        id: `note-${n.id}`,
        type: 'note',
        title: 'Заметка',
        preview: n.content.slice(0, 180),
        at: n.createdAt.toISOString(),
        meta: { noteId: n.id },
      });
    }
    for (const s of sessions) {
      items.push({
        id: `session-${s.id}`,
        type: 'session',
        title: 'Сессия',
        preview: s.summary?.slice(0, 180) || null,
        at: s.date.toISOString(),
        meta: { sessionId: s.id },
      });
    }
    for (const d of documents) {
      const preview = stripHtml(d.content).slice(0, 180);
      items.push({
        id: `doc-${d.id}`,
        type: 'document',
        title: `Документ: ${d.tabName}`,
        preview: preview || null,
        at: d.updatedAt.toISOString(),
        meta: { documentId: d.id, tabName: d.tabName },
      });
    }
    for (const d of dreams) {
      items.push({
        id: `dream-${d.id}`,
        type: 'dream',
        title: d.title || 'Сон',
        preview: (d.content || '').slice(0, 180),
        at: d.createdAt.toISOString(),
        meta: { dreamId: d.id },
      });
    }
    for (const j of journal) {
      items.push({
        id: `journal-${j.id}`,
        type: 'journal',
        title: 'Дневник',
        preview: j.content.slice(0, 180),
        at: j.createdAt.toISOString(),
        meta: { journalId: j.id },
      });
    }
    for (const t of clientTasks) {
      items.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        preview: t.status === 'done' ? 'Выполнена' : 'Открыта',
        at: t.createdAt.toISOString(),
        meta: { taskId: t.id, status: t.status, dueAt: t.dueAt },
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    res.json({ items: items.slice(0, limit) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load activity' });
  }
});

// Документы рабочей области
router.get('/clients/:id/documents', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const items = await prisma.clientDocument.findMany({ 
    where: { clientId: req.params.id, psychologistId: req.user!.id },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({ items });
});

router.get('/clients/:id/documents/:tabName', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const doc = await prisma.clientDocument.findFirst({
    where: { 
      clientId: req.params.id, 
      tabName: req.params.tabName,
      psychologistId: req.user!.id
    }
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json(doc);
});

router.post('/clients/:id/documents', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { tabName, content, changeNote } = req.body ?? {};
    if (!tabName) return res.status(400).json({ error: 'tabName is required' });
    
    // Проверяем, существует ли документ
    const existing = await (prisma as any).clientDocument.findFirst({
      where: {
        clientId: req.params.id,
        tabName: tabName,
        psychologistId: req.user!.id
      }
    });

    let doc;
    if (existing) {
      // Сохраняем версию перед обновлением
      await (prisma as any).documentVersion.create({
        data: {
          documentId: existing.id,
          content: existing.content,
          changedBy: req.user!.id,
          changeNote: changeNote || null
        }
      });
      
      doc = await (prisma as any).clientDocument.update({
        where: { id: existing.id },
        data: { content: content || '' }
      });
    } else {
      doc = await (prisma as any).clientDocument.create({
        data: {
          clientId: req.params.id,
          tabName: tabName,
          content: content || '',
          psychologistId: req.user!.id
        }
      });
    }
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save document' });
  }
});

// Управление вкладками клиента
router.get('/clients/:id/tabs', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const clientTabs = await (prisma as any).clientTabs.findUnique({
      where: { clientId: req.params.id }
    });
    
    const defaultTabs = [
      'Ведение клиента',
      'запрос',
      'анамнез',
      'ценности/кредо',
      'раздражители',
      'сны',
      'Тесты',
      'записи',
      'Дневник клиента',
      'Синхронии'
    ];

    if (!clientTabs) {
      return res.json({ tabs: defaultTabs });
    }

    const stored = Array.isArray(clientTabs.tabs) ? clientTabs.tabs.map(String) : [];
    if (!stored.includes('Тесты')) {
      const dreamsIdx = stored.indexOf('сны');
      const withTests =
        dreamsIdx >= 0
          ? [...stored.slice(0, dreamsIdx + 1), 'Тесты', ...stored.slice(dreamsIdx + 1)]
          : [...stored, 'Тесты'];
      return res.json({ tabs: withTests });
    }

    res.json({ tabs: stored });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load tabs' });
  }
});

router.post('/clients/:id/tabs', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { tabs } = req.body ?? {};
    if (!Array.isArray(tabs)) {
      return res.status(400).json({ error: 'tabs must be an array' });
    }
    
    const existing = await (prisma as any).clientTabs.findUnique({
      where: { clientId: req.params.id }
    });
    
    let clientTabs;
    if (existing) {
      clientTabs = await (prisma as any).clientTabs.update({
        where: { clientId: req.params.id },
        data: { tabs, psychologistId: req.user!.id }
      });
    } else {
      clientTabs = await (prisma as any).clientTabs.create({
        data: {
          clientId: req.params.id,
          tabs,
          psychologistId: req.user!.id
        }
      });
    }
    
    res.status(201).json({ tabs: clientTabs.tabs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save tabs' });
  }
});

// Получить историю версий документа
router.get('/clients/:id/documents/:tabName/versions', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const doc = await (prisma as any).clientDocument.findFirst({
      where: {
        clientId: req.params.id,
        tabName: req.params.tabName,
        psychologistId: req.user!.id
      }
    });
    
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    const versions = await (prisma as any).documentVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { changedAt: 'desc' }
    });
    
    res.json({ items: versions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get document versions' });
  }
});

// Получить записи дневника клиента (для психолога)
router.get('/clients/:id/journal', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const entries = await prisma.journalEntry.findMany({
      where: { clientId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ items: entries });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get journal entries' });
  }
});

export default router;

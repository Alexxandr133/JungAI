import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole, requireVerification, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { config } from '../config';

const router = Router();

// Настройка multer для загрузки аватаров клиентов
// Используем process.cwd() для определения корня проекта (работает и в dev, и в production)
const uploadsBaseDir = path.join(process.cwd(), 'backend', 'uploads');
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
router.get('/my-psychologist', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    console.log('[my-psychologist] Request from user:', req.user!.email, 'role:', req.user!.role);
    
    // Ищем Client сущность по email пользователя
    let client = await prisma.client.findFirst({
      where: { email: req.user!.email },
      select: { id: true, psychologistId: true, name: true }
    });
    
    console.log('[my-psychologist] Client found:', client ? { id: client.id, psychologistId: client.psychologistId } : 'not found');
    
    // Если не найдено по точному совпадению, пробуем найти по части email
    if (!client && req.user!.email.includes('@demo.jung')) {
      client = await prisma.client.findFirst({
        where: { 
          email: { contains: req.user!.email.split('@')[0] }
        },
        select: { id: true, psychologistId: true, name: true }
      });
    }
    
    // Принудительно создаем/обновляем демо-психолога
    // Сначала ищем по email, чтобы избежать конфликта уникальности
    let demoPsychologist = await prisma.user.findUnique({
      where: { email: 'psy@example.com' },
      select: { id: true }
    });
    
    if (!demoPsychologist) {
      // Если не найден по email, ищем по ID
      demoPsychologist = await prisma.user.findUnique({
        where: { id: 'u1' },
        select: { id: true }
      });
      
      if (!demoPsychologist) {
        // Создаем нового только если не найден ни по email, ни по ID
        demoPsychologist = await prisma.user.create({
          data: {
            id: 'u1',
            email: 'psy@example.com',
            password: 'demo',
            role: 'psychologist',
            isVerified: true
          },
          select: { id: true }
        });
      } else {
        // Если найден по ID, обновляем email и роль
        await prisma.user.update({
          where: { id: 'u1' },
          data: {
            email: 'psy@example.com',
            role: 'psychologist',
            isVerified: true
          }
        });
      }
    } else {
      // Если найден по email, обновляем роль и верификацию
      await prisma.user.update({
        where: { email: 'psy@example.com' },
        data: {
          role: 'psychologist',
          isVerified: true
        }
      });
    }
    
    // Если клиент не найден, пытаемся найти психолога по email клиента
    if (!client) {
      // Для демо клиентов вида client.xxx@demo.jung ищем соответствующего психолога
      if (req.user!.email.includes('@demo.jung') && req.user!.email.startsWith('client.')) {
        const clientPrefix = req.user!.email.replace('client.', '').split('@')[0];
        // Ищем психолога с соответствующим префиксом в email
        const matchingPsychologist = await prisma.user.findFirst({
          where: {
            email: { contains: clientPrefix },
            role: 'psychologist'
          },
          select: { id: true }
        });
        
        if (matchingPsychologist) {
          // Создаем Client с найденным психологом
          client = await prisma.client.create({
            data: {
              name: req.user!.email.split('@')[0],
              email: req.user!.email,
              psychologistId: matchingPsychologist.id
            },
            select: { id: true, psychologistId: true, name: true }
          });
        } else {
          // Если психолог не найден, создаем с демо-психологом
          client = await prisma.client.create({
            data: {
              name: req.user!.email.split('@')[0],
              email: req.user!.email,
              psychologistId: demoPsychologist.id
            },
            select: { id: true, psychologistId: true, name: true }
          });
        }
      } else {
        // Для остальных клиентов создаем с демо-психологом
        client = await prisma.client.create({
          data: {
            name: req.user!.email.split('@')[0],
            email: req.user!.email,
            psychologistId: demoPsychologist.id
          },
          select: { id: true, psychologistId: true, name: true }
        });
      }
    }
    
    // Проверяем, является ли это демо-клиентом
    const isDemoClient = req.user!.id === 'u2' || req.user!.email === 'client@example.com';
    
    // Если у клиента нет психолога или это временный ID, назначаем демо-психолога
    // НО НЕ перезаписываем реального психолога, даже для демо-клиентов
    if (!client.psychologistId || client.psychologistId.startsWith('temp-')) {
      await prisma.client.update({
        where: { id: client.id },
        data: { psychologistId: demoPsychologist.id }
      });
      client.psychologistId = demoPsychologist.id;
    }
    
    // Принудительно создаем комнату чата для демо-клиента и демо-психолога
    const clientName = client.name || req.user!.email.split('@')[0];
    if (isDemoClient) {
      // Проверяем, существует ли уже комната с таким именем
      const existingRoom = await prisma.chatRoom.findFirst({
        where: { name: clientName }
      });
      
      // Если комнаты нет, создаем ее
      if (!existingRoom) {
        await prisma.chatRoom.create({
          data: { name: clientName }
        });
      }
    }
    
    const psychologist = await prisma.user.findUnique({
      where: { id: client.psychologistId },
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
      // Если психолог не найден, используем уже созданного демо-психолога
      const demoPsych = await prisma.user.findUnique({
        where: { id: demoPsychologist.id },
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
      
      if (!demoPsych) {
        // Если демо-психолог не найден, возвращаем ошибку
        return res.status(404).json({ error: 'Psychologist not found' });
      }
      
      // Обновляем клиента
      await prisma.client.update({
        where: { id: client.id },
        data: { psychologistId: demoPsych.id }
      });
      
      // Принудительно создаем комнату чата
      const clientNameForRoom = client.name || req.user!.email.split('@')[0];
      const existingRoom = await prisma.chatRoom.findFirst({
        where: { name: clientNameForRoom }
      });
      
      if (!existingRoom) {
        await prisma.chatRoom.create({
          data: { name: clientNameForRoom }
        });
      }
      
      return res.json({
        id: demoPsych.id,
        email: demoPsych.email,
        name: demoPsych.profile?.name || demoPsych.email.split('@')[0],
        avatarUrl: demoPsych.profile?.avatarUrl || null,
        bio: demoPsych.profile?.bio || null,
        specialization: demoPsych.profile?.specialization || null
      });
    }
    
    // Принудительно создаем комнату чата для демо-клиента (если еще не создана)
    // Используем уже объявленную переменную isDemoClient из строки 80
    if (isDemoClient) {
      const clientNameForRoom = client.name || req.user!.email.split('@')[0];
      const existingRoom = await prisma.chatRoom.findFirst({
        where: { name: clientNameForRoom }
      });
      
      if (!existingRoom) {
        await prisma.chatRoom.create({
          data: { name: clientNameForRoom }
        });
      }
    }
    
    // Всегда возвращаем успешный ответ с данными психолога
    const response = {
      id: psychologist.id,
      email: psychologist.email,
      name: psychologist.profile?.name || psychologist.email.split('@')[0],
      avatarUrl: psychologist.profile?.avatarUrl || null,
      bio: psychologist.profile?.bio || null,
      specialization: psychologist.profile?.specialization || null
    };
    
    console.log('[my-psychologist] Returning psychologist:', { id: response.id, name: response.name });
    res.json(response);
  } catch (error: any) {
    // В случае ошибки все равно пытаемся вернуть демо-психолога
    console.error('Error in /my-psychologist:', error);
    try {
      const fallbackPsych = await prisma.user.findFirst({
        where: { 
          email: 'psy@example.com',
          role: 'psychologist'
        },
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
      
      if (fallbackPsych) {
        return res.json({
          id: fallbackPsych.id,
          email: fallbackPsych.email,
          name: fallbackPsych.profile?.name || fallbackPsych.email.split('@')[0],
          avatarUrl: fallbackPsych.profile?.avatarUrl || null,
          bio: fallbackPsych.profile?.bio || null,
          specialization: fallbackPsych.profile?.specialization || null
        });
      }
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
    
    // Если даже fallback не сработал, возвращаем ошибку
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
    // Получаем клиентов, исключая временные записи (temp-*)
    const clients = await prisma.client.findMany({ 
      where: { 
        psychologistId: req.user!.id,
        // Исключаем клиентов с временным psychologistId
        NOT: {
          psychologistId: { startsWith: 'temp-' }
        }
      }, 
      orderBy: { createdAt: 'desc' } 
    });
    
    // Используем Set для удаления дубликатов по email
    const uniqueClients = new Map();
    for (const client of clients) {
      if (client.email && !uniqueClients.has(client.email)) {
        uniqueClients.set(client.email, client);
      } else if (!client.email && !uniqueClients.has(client.id)) {
        uniqueClients.set(client.id, client);
      }
    }
    
    // Обогащаем клиентов данными профиля
    const items = await Promise.all(Array.from(uniqueClients.values()).map(async (client: any) => {
      if (!client.email) return client;
      
      const user = await prisma.user.findUnique({
        where: { email: client.email },
        include: { profile: true }
      });
      
      return {
        ...client,
        profile: user?.profile || null,
        avatarUrl: user?.profile?.avatarUrl || null
      };
    }));
    
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get clients' });
  }
});

router.post('/clients', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { name, email, phone, age, city, tags, username } = req.body ?? {};
  
  // Генерируем токен регистрации
  const crypto = require('crypto');
  const registrationToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Токен действителен 7 дней
  
  const c = await prisma.client.create({ 
    data: { 
      name, 
      email: email || (username ? `${username}@jungai.local` : undefined), 
      phone, 
      psychologistId: req.user!.id,
      registrationToken,
      tokenExpiresAt
    } 
  });
  
  res.status(201).json({
    ...c,
    username: username || null,
    registrationLink: `${config.frontendUrl}/register-client?token=${registrationToken}`
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
        psychologistId: true,
        createdAt: true
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
    const user = await prisma.user.findFirst({
      where: { email: client.email || '' },
      include: {
        profile: true
      }
    });
    
    res.json({
      ...client,
      profile: user?.profile || null,
      userId: user?.id || null,
      avatarUrl: user?.profile?.avatarUrl || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get client' });
  }
});

// Получить профиль клиента (для самого клиента)
router.get('/client/profile', requireAuth, requireRole(['client', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.user!.email }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: req.user!.email },
      include: {
        profile: true
      }
    });
    
    res.json({
      client,
      profile: user?.profile || null
    });
  } catch (error: any) {
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
    const user = await prisma.user.findUnique({
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
    
    const user = await prisma.user.findUnique({
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

// Удаление клиента (и связанных сущностей)
router.delete('/clients/:id', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const clientId = req.params.id;

  // Проверяем принадлежность клиента психологу (или роль admin)
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user!.role !== 'admin' && client.psychologistId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Удаляем зависимые записи вручную (отношения не определены на уровне Prisma)
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
router.get('/clients/:id/notes', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req, res) => {
  const items = await prisma.clientNote.findMany({ where: { clientId: req.params.id }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

router.post('/clients/:id/notes', requireAuth, requireRole(['psychologist', 'admin']), requireVerification, async (req: AuthedRequest, res) => {
  const { content } = req.body ?? {};
  const n = await prisma.clientNote.create({ data: { clientId: req.params.id, authorId: req.user!.id, content } });
  res.status(201).json(n);
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
    
    if (!clientTabs) {
      // Возвращаем дефолтные вкладки
      const defaultTabs = [
        'Ведение клиента',
        'запрос',
        'анамнез',
        'ценности/кредо',
        'раздражители',
        'сны',
        'записи',
        'Дневник клиента',
        'Синхронии'
      ];
      return res.json({ tabs: defaultTabs });
    }
    
    res.json({ tabs: clientTabs.tabs });
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

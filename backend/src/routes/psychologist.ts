import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Публичный список психологов (для гостей)
router.get('/public', async (req, res) => {
  try {
    // Исключаем только старые ошибочные аккаунты с "Trafimov.*"
    const wrongDemoEmails = [
      'Trafimov.Val@demo.jung',
      'Trafimov.Rom@demo.jung',
      'Trafimov.Mak@demo.jung',
    ];

    const psychologists = await prisma.user.findMany({
      where: {
        role: 'psychologist',
        isVerified: true, // Только верифицированные психологи
        email: {
          notIn: wrongDemoEmails, // исключаем только неверные демо-аккаунты
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const psychologistIds = psychologists.map(p => p.id);
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: psychologistIds }
      },
      select: {
        userId: true,
        name: true,
        bio: true,
        specialization: true,
        experience: true,
        avatarUrl: true
      }
    });

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const result = psychologists.map(psych => {
      const profile = profileMap.get(psych.id);
      return {
        id: psych.id,
        name: profile?.name || psych.email.split('@')[0],
        email: psych.email,
        bio: profile?.bio || null,
        specialization: profile?.specialization ? (typeof profile.specialization === 'string' ? [profile.specialization] : profile.specialization) : [],
        experience: profile?.experience ? parseInt(String(profile.experience)) || 0 : 0,
        avatarUrl: profile?.avatarUrl || null,
        verified: true,
        rating: 4.5 + Math.random() * 0.5, // Demo rating
        reviewsCount: Math.floor(Math.random() * 50) + 10 // Demo reviews count
      };
    });

    res.json({ psychologists: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists' });
  }
});

// Настройка multer для загрузки файлов
// Используем process.cwd() для определения корня проекта (работает и в dev, и в production)
const uploadsBaseDir = path.join(process.cwd(), 'backend', 'uploads');
const verificationDir = path.join(uploadsBaseDir, 'verification');
const avatarsDir = path.join(uploadsBaseDir, 'avatars');
if (!fs.existsSync(verificationDir)) {
  fs.mkdirSync(verificationDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const verificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, verificationDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `verification-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadVerification = multer({
  storage: verificationStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream';
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла. Разрешены: PDF, JPG, PNG, DOC, DOCX'));
    }
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

// Получить профиль психолога
router.get('/profile', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
    });
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isVerified: true, role: true }
    });

    // Админы всегда считаются верифицированными
    const isVerified = req.user!.role === 'admin' ? true : (user?.isVerified || false);

    res.json({
      name: profile?.name || '',
      avatarUrl: profile?.avatarUrl || null,
      phone: profile?.phone || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      specialization: profile?.specialization || '',
      experience: profile?.experience || '',
      isVerified
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load profile' });
  }
});

// Обновить профиль психолога
router.put('/profile', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { name, phone, location, bio, specialization, experience } = req.body ?? {};
    
    await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: {
        name,
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
        ...(bio !== undefined && { bio }),
        ...(specialization !== undefined && { specialization }),
        ...(experience !== undefined && { experience })
      },
      create: {
        userId: req.user!.id,
        name: name || '',
        interests: [],
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
        ...(bio !== undefined && { bio }),
        ...(specialization !== undefined && { specialization }),
        ...(experience !== undefined && { experience })
      }
    });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update profile' });
  }
});

// Загрузить аватар
router.post('/profile/avatar', requireAuth, requireRole(['psychologist', 'admin']), uploadAvatar.single('avatar'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
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
    console.log(`[Psychologist] Avatar uploaded: ${req.file.filename}`);
    console.log(`[Psychologist] Avatar saved to: ${req.file.path}`);
    console.log(`[Psychologist] Avatar URL: ${avatarUrl}`);
    
    await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: { avatarUrl },
      create: {
        userId: req.user!.id,
        avatarUrl,
        interests: []
      }
    });
    
    res.json({ success: true, avatarUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to upload avatar' });
  }
});

// Получить статус верификации
router.get('/verification/status', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const request = await prisma.verificationRequest.findUnique({
      where: { userId: req.user!.id }
    });
    
    if (!request) {
      return res.json({ status: 'none' });
    }
    
    res.json({ 
      status: request.status,
      comment: request.comment || null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load verification status' });
  }
});

// Отправить документ на верификацию
router.post('/verification/submit', requireAuth, requireRole(['psychologist', 'admin']), uploadVerification.single('document'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Документ не загружен' });
    }
    
    // Проверяем, что пользователь существует в базе данных
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, нет ли уже запроса
    const existing = await prisma.verificationRequest.findUnique({
      where: { userId: req.user!.id }
    });
    
    if (existing) {
      // Удаляем старый файл, если он существует
      if (fs.existsSync(existing.documentPath)) {
        fs.unlinkSync(existing.documentPath);
      }
      // Обновляем существующий запрос (сбрасываем статус на pending)
      await prisma.verificationRequest.update({
        where: { userId: req.user!.id },
        data: {
          documentPath: req.file.path,
          fileName: req.file.originalname,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          comment: null
        }
      });
    } else {
      // Создаем новый запрос только если его еще нет
      await prisma.verificationRequest.create({
        data: {
          userId: req.user!.id,
          documentPath: req.file.path,
          fileName: req.file.originalname,
          status: 'pending'
        }
      });
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to submit verification document' });
  }
});

export default router;


import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

// Настройка multer для загрузки файлов
const verificationDir = path.join(__dirname, '../../uploads/verification');
const avatarsDir = path.join(__dirname, '../../uploads/avatars');
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

// Получить профиль исследователя
router.get('/profile', requireAuth, requireRole(['researcher', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
    });
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isVerified: true }
    });

    res.json({
      name: profile?.name || '',
      avatarUrl: profile?.avatarUrl || null,
      phone: profile?.phone || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      specialization: profile?.specialization || '',
      experience: profile?.experience || '',
      isVerified: user?.isVerified || false
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load profile' });
  }
});

// Обновить профиль исследователя
router.put('/profile', requireAuth, requireRole(['researcher', 'admin']), async (req: AuthedRequest, res) => {
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
router.post('/profile/avatar', requireAuth, requireRole(['researcher', 'admin']), uploadAvatar.single('avatar'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
    });
    
    // Удаляем старый аватар, если есть
    if (profile?.avatarUrl) {
      const oldPath = path.join(__dirname, '../../', profile.avatarUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // Сохраняем относительный путь для URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
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
router.get('/verification/status', requireAuth, requireRole(['researcher', 'admin']), async (req: AuthedRequest, res) => {
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
router.post('/verification/submit', requireAuth, requireRole(['researcher', 'admin']), uploadVerification.single('document'), async (req: AuthedRequest, res) => {
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
    
    // Создаем или обновляем запрос на верификацию
    await prisma.verificationRequest.upsert({
      where: { userId: req.user!.id },
      update: {
        documentPath: `/uploads/verification/${req.file.filename}`,
        fileName: req.file.originalname,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        comment: null,
        updatedAt: new Date()
      },
      create: {
        userId: req.user!.id,
        documentPath: `/uploads/verification/${req.file.filename}`,
        fileName: req.file.originalname,
        status: 'pending'
      }
    });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to submit verification' });
  }
});

export default router;

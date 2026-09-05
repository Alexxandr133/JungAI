import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { getUploadsRoot } from '../utils/uploadsRoot';
import { readAcceptingClients, writeAcceptingClients } from '../utils/acceptingClients';

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
        verified: true
      };
    });

    res.json({ psychologists: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load psychologists' });
  }
});

// Настройка multer для загрузки файлов
const uploadsBaseDir = getUploadsRoot();
const verificationDir = path.join(uploadsBaseDir, 'verification');
const avatarsDir = path.join(uploadsBaseDir, 'avatars');
const coversDir = path.join(uploadsBaseDir, 'covers');
if (!fs.existsSync(verificationDir)) {
  fs.mkdirSync(verificationDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
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

const coverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, coversDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cover-${uniqueSuffix}${path.extname(file.originalname)}`);
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

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/webp';
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла. Разрешены: JPG, PNG, WEBP'));
    }
  }
});

// Получить профиль психолога
router.get('/profile', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    try {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PsychologistEducation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "kind" TEXT NOT NULL,
        "institution" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "yearFrom" INTEGER NOT NULL,
        "yearTo" INTEGER,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )`);
      const cols = async (col: string, ddl: string) => {
        const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("Profile")`)) as any[];
        if (!rows.some((r) => r.name === col)) await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN ${ddl}`);
      };
      await cols('sessionPriceRub', '"sessionPriceRub" INTEGER');
      await cols('therapyMethod', '"therapyMethod" TEXT');
      await cols('worksWith', '"worksWith" JSONB');
      await cols('audienceFormats', '"audienceFormats" JSONB');
      await cols('calendarPrefs', '"calendarPrefs" JSONB');
      await cols('sessionTestSettings', '"sessionTestSettings" JSONB');
      await cols('coverUrl', '"coverUrl" TEXT');
      await cols('accentColor', '"accentColor" TEXT');
    } catch { /* ignore */ }
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    // Prisma client может быть без coverUrl/accentColor — читаем сырым SQL
    let coverUrl: string | null = (profile as any)?.coverUrl ?? null;
    let accentColor: string | null = (profile as any)?.accentColor ?? null;
    let sessionPriceRub: number | null = (profile as any)?.sessionPriceRub ?? null;
    let therapyMethod: string = (profile as any)?.therapyMethod || '';
    let worksWithRaw: unknown = (profile as any)?.worksWith;
    let audienceRaw: unknown = (profile as any)?.audienceFormats;
    let calendarPrefs: unknown = (profile as any)?.calendarPrefs ?? null;
    try {
      const ext = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "coverUrl","accentColor","sessionPriceRub","therapyMethod","worksWith","audienceFormats","calendarPrefs"
         FROM "Profile" WHERE "userId" = ? LIMIT 1`,
        req.user!.id
      );
      const row = ext?.[0];
      if (row) {
        if (row.coverUrl !== undefined) coverUrl = row.coverUrl ?? null;
        if (row.accentColor !== undefined) accentColor = row.accentColor ?? null;
        if (row.sessionPriceRub !== undefined) sessionPriceRub = row.sessionPriceRub ?? null;
        if (row.therapyMethod !== undefined) therapyMethod = row.therapyMethod || '';
        if (row.worksWith !== undefined) worksWithRaw = row.worksWith;
        if (row.audienceFormats !== undefined) audienceRaw = row.audienceFormats;
        if (row.calendarPrefs !== undefined) calendarPrefs = row.calendarPrefs;
      }
    } catch {
      /* колонки могут отсутствовать до миграции */
    }

    let educations: any[] = [];
    try {
      educations = await prisma.$queryRawUnsafe(
        `SELECT "id","kind","institution","title","yearFrom","yearTo" FROM "PsychologistEducation" WHERE "userId" = ? ORDER BY "yearFrom" DESC, "createdAt" DESC`,
        req.user!.id
      );
    } catch {
      educations = [];
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isVerified: true, role: true }
    });
    const acceptingClientsFlag = await readAcceptingClients(req.user!.id);

    // Админы всегда считаются верифицированными
    const isVerified = req.user!.role === 'admin' ? true : (user?.isVerified || false);

    const parseJsonArray = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw.map(String);
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      }
      return [];
    };
    const worksWith = parseJsonArray(worksWithRaw);
    const audienceFormats = parseJsonArray(audienceRaw);

    res.json({
      name: profile?.name || '',
      avatarUrl: profile?.avatarUrl || null,
      coverUrl,
      accentColor,
      phone: profile?.phone || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      specialization: profile?.specialization || '',
      experience: profile?.experience || '',
      sessionPriceRub,
      therapyMethod,
      worksWith,
      audienceFormats,
      calendarPrefs,
      educations: educations.map((e) => ({
        id: e.id,
        kind: e.kind,
        institution: e.institution,
        title: e.title,
        yearFrom: e.yearFrom,
        yearTo: e.yearTo,
      })),
      isVerified,
      acceptingClients: acceptingClientsFlag
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load profile' });
  }
});

router.get('/profile/completeness', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const { computeProfileCompleteness } = await import('../utils/matchEngine');
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });
    let educationCount = 0;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as c FROM "PsychologistEducation" WHERE "userId" = ?`,
        req.user!.id
      );
      educationCount = Number(rows?.[0]?.c || 0);
    } catch {
      educationCount = 0;
    }
    const result = computeProfileCompleteness({
      name: profile?.name,
      avatarUrl: profile?.avatarUrl,
      bio: profile?.bio,
      therapyMethod: (profile as any)?.therapyMethod,
      specialization: profile?.specialization,
      sessionPriceRub: (profile as any)?.sessionPriceRub,
      worksWith: (profile as any)?.worksWith,
      audienceFormats: (profile as any)?.audienceFormats,
      educationCount,
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to check completeness' });
  }
});

// Обновить профиль психолога
router.put('/profile', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const {
      name,
      phone,
      location,
      bio,
      specialization,
      experience,
      sessionPriceRub,
      therapyMethod,
      worksWith,
      audienceFormats,
      calendarPrefs,
      accentColor,
      acceptingClients,
    } = req.body ?? {};

    const worksArr = Array.isArray(worksWith) ? worksWith.map(String).slice(0, 24) : undefined;
    const audienceArr = Array.isArray(audienceFormats)
      ? audienceFormats.map(String).filter((x: string) => ['self', 'couple', 'child'].includes(x)).slice(0, 3)
      : undefined;
    const price =
      sessionPriceRub === null || sessionPriceRub === ''
        ? null
        : Number.isFinite(Number(sessionPriceRub))
          ? Math.max(0, Math.round(Number(sessionPriceRub)))
          : undefined;

    if (typeof acceptingClients === 'boolean') {
      try {
        await writeAcceptingClients(req.user!.id, acceptingClients);
      } catch (e) {
        console.warn('acceptingClients update failed', e);
      }
    }

    const hasProfileFields =
      name !== undefined ||
      phone !== undefined ||
      location !== undefined ||
      bio !== undefined ||
      specialization !== undefined ||
      experience !== undefined ||
      sessionPriceRub !== undefined ||
      therapyMethod !== undefined ||
      worksWith !== undefined ||
      audienceFormats !== undefined ||
      calendarPrefs !== undefined ||
      accentColor !== undefined;

    if (!hasProfileFields) {
      return res.json({ success: true });
    }

    const data: any = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(location !== undefined && { location }),
      ...(bio !== undefined && { bio }),
      ...(specialization !== undefined && { specialization }),
      ...(experience !== undefined && { experience }),
    };
    // Новые поля — через raw, если Prisma client ещё без них
    await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: {
        userId: req.user!.id,
        name: name || '',
        interests: [],
        ...data,
      }
    });

    const sets: string[] = [];
    const vals: any[] = [];
    if (price !== undefined) {
      sets.push(`"sessionPriceRub" = ?`);
      vals.push(price);
    }
    if (therapyMethod !== undefined) {
      sets.push(`"therapyMethod" = ?`);
      vals.push(String(therapyMethod).slice(0, 120));
    }
    if (worksArr !== undefined) {
      sets.push(`"worksWith" = ?`);
      vals.push(JSON.stringify(worksArr));
    }
    if (audienceArr !== undefined) {
      sets.push(`"audienceFormats" = ?`);
      vals.push(JSON.stringify(audienceArr));
    }
    if (calendarPrefs !== undefined && typeof calendarPrefs === 'object') {
      sets.push(`"calendarPrefs" = ?`);
      vals.push(JSON.stringify(calendarPrefs));
    }
    if (accentColor !== undefined) {
      const accent =
        typeof accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(accentColor.trim())
          ? accentColor.trim().toLowerCase()
          : accentColor === null || accentColor === ''
            ? null
            : undefined;
      if (accent !== undefined) {
        sets.push(`"accentColor" = ?`);
        vals.push(accent);
      }
    }
    if (sets.length) {
      vals.push(req.user!.id);
      try {
        // Гарантируем колонки перед записью
        const cols = async (col: string, ddl: string) => {
          const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("Profile")`)) as any[];
          if (!rows.some((r) => r.name === col)) await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN ${ddl}`);
        };
        await cols('sessionPriceRub', '"sessionPriceRub" INTEGER');
        await cols('therapyMethod', '"therapyMethod" TEXT');
        await cols('worksWith', '"worksWith" JSONB');
        await cols('audienceFormats', '"audienceFormats" JSONB');
        await cols('calendarPrefs', '"calendarPrefs" JSONB');
        await cols('sessionTestSettings', '"sessionTestSettings" JSONB');
        await cols('coverUrl', '"coverUrl" TEXT');
        await cols('accentColor', '"accentColor" TEXT');
        await prisma.$executeRawUnsafe(`UPDATE "Profile" SET ${sets.join(', ')} WHERE "userId" = ?`, ...vals);
      } catch (e) {
        console.warn('profile extended fields update failed', e);
        return res.status(500).json({ error: 'Не удалось сохранить оформление профиля (акцент/цена). Обновите схему БД.' });
      }
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update profile' });
  }
});

/** Заменить список образований целиком */
router.put('/profile/educations', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const items = Array.isArray(req.body?.educations) ? req.body.educations : [];
    const normalized = items
      .map((raw: any) => {
        const kind = ['higher', 'course', 'supervision', 'other'].includes(raw?.kind) ? raw.kind : 'other';
        const institution = String(raw?.institution || '').trim().slice(0, 200);
        const title = String(raw?.title || '').trim().slice(0, 200);
        const yearFrom = Number(raw?.yearFrom);
        const yearTo = raw?.yearTo === null || raw?.yearTo === '' ? null : Number(raw?.yearTo);
        if (!institution || !title || !Number.isFinite(yearFrom) || yearFrom < 1950 || yearFrom > 2100) return null;
        if (yearTo != null && (!Number.isFinite(yearTo) || yearTo < yearFrom || yearTo > 2100)) return null;
        return { kind, institution, title, yearFrom, yearTo };
      })
      .filter(Boolean)
      .slice(0, 30) as Array<{ kind: string; institution: string; title: string; yearFrom: number; yearTo: number | null }>;

    await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: { userId: req.user!.id, name: '', interests: [] },
    });

    await prisma.$executeRawUnsafe(`DELETE FROM "PsychologistEducation" WHERE "userId" = ?`, req.user!.id);
    for (const e of normalized) {
      const id = `edu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PsychologistEducation" ("id","userId","kind","institution","title","yearFrom","yearTo","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        id,
        req.user!.id,
        e.kind,
        e.institution,
        e.title,
        e.yearFrom,
        e.yearTo
      );
    }

    const educations = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","kind","institution","title","yearFrom","yearTo" FROM "PsychologistEducation" WHERE "userId" = ? ORDER BY "yearFrom" DESC`,
      req.user!.id
    );
    res.json({ educations });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save educations' });
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

router.post('/profile/cover', requireAuth, requireRole(['psychologist', 'admin']), uploadCover.single('cover'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id }
    });

    const oldCover = (profile as any)?.coverUrl as string | undefined;
    if (oldCover) {
      const oldPath = path.join(uploadsBaseDir, oldCover.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const coverUrl = `/uploads/covers/${req.file.filename}`;
    await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: {},
      create: {
        userId: req.user!.id,
        interests: [],
      }
    });
    try {
      await prisma.$executeRawUnsafe(`UPDATE "Profile" SET "coverUrl" = ? WHERE "userId" = ?`, coverUrl, req.user!.id);
    } catch (e) {
      console.warn('coverUrl column update failed', e);
      return res.status(500).json({ error: 'Не удалось сохранить обложку — обновите схему БД' });
    }
    // Повторно читаем, чтобы убедиться что значение на месте
    try {
      const check = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "coverUrl" FROM "Profile" WHERE "userId" = ? LIMIT 1`,
        req.user!.id
      );
      if (!check?.[0]?.coverUrl) {
        return res.status(500).json({ error: 'Обложка не записалась в БД' });
      }
    } catch {
      /* ignore verify errors */
    }

    res.json({ success: true, coverUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to upload cover' });
  }
});

router.delete('/profile/cover', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT "coverUrl" FROM "Profile" WHERE "userId" = ? LIMIT 1`, req.user!.id);
    const oldCover = rows?.[0]?.coverUrl as string | undefined;
    if (oldCover) {
      const oldPath = path.join(uploadsBaseDir, oldCover.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await prisma.$executeRawUnsafe(`UPDATE "Profile" SET "coverUrl" = NULL WHERE "userId" = ?`, req.user!.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to remove cover' });
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

function parseAssociationWordBank(raw: unknown): string[] {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  }
  const list = Array.isArray((obj as { associationWords?: unknown })?.associationWords)
    ? (obj as { associationWords: unknown[] }).associationWords
    : [];
  return list.map((w) => String(w || '').trim()).filter(Boolean);
}

async function ensureSessionTestSettingsColumn() {
  try {
    const rows = (await prisma.$queryRawUnsafe<any[]>(`PRAGMA table_info("Profile")`)) as any[];
    if (!rows.some((r) => r.name === 'sessionTestSettings')) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Profile" ADD COLUMN "sessionTestSettings" JSONB`);
    }
  } catch {
    /* ignore */
  }
}

router.get('/session-test-settings', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureSessionTestSettingsColumn();
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    let raw: unknown = (profile as { sessionTestSettings?: unknown } | null)?.sessionTestSettings ?? null;
    if (raw == null) {
      try {
        const ext = await prisma.$queryRawUnsafe<any[]>(
          `SELECT "sessionTestSettings" FROM "Profile" WHERE "userId" = ? LIMIT 1`,
          req.user!.id
        );
        raw = ext?.[0]?.sessionTestSettings ?? null;
      } catch {
        /* ignore */
      }
    }
    res.json({ associationWords: parseAssociationWordBank(raw) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load session test settings' });
  }
});

router.put('/session-test-settings', requireAuth, requireRole(['psychologist', 'admin']), async (req: AuthedRequest, res) => {
  try {
    await ensureSessionTestSettingsColumn();
    const associationWords = parseAssociationWordBank({ associationWords: req.body?.associationWords });
    const settings = { associationWords };
    try {
      await (prisma as any).profile.upsert({
        where: { userId: req.user!.id },
        update: { sessionTestSettings: settings },
        create: { userId: req.user!.id, interests: [], sessionTestSettings: settings }
      });
    } catch {
      const existing = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
      if (!existing) {
        await prisma.profile.create({ data: { userId: req.user!.id, interests: [] } });
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "Profile" SET "sessionTestSettings" = ? WHERE "userId" = ?`,
        JSON.stringify(settings),
        req.user!.id
      );
    }
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save session test settings' });
  }
});

export default router;


import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

const router = Router();

const DEFAULT_UPDATES = [
  {
    id: 'seed-platform-1',
    title: 'Старт раздела "О платформе"',
    description: 'Добавлен централизованный раздел с инструкциями и обзором возможностей по ролям.',
    details: [
      'Раздел доступен клиентам, психологам, исследователям и администраторам.',
      'Добавлена вкладка "Обновления" с лентой изменений платформы.'
    ],
    publishedAt: new Date('2026-04-26T08:00:00.000Z')
  },
  {
    id: 'seed-platform-2',
    title: 'Новый формат релиз-ленты',
    description: 'Раздел обновлений оформлен как удобная лента с акцентом на практическую пользу.',
    details: [
      'Каждое обновление показывает смысл изменений и ключевые пункты.',
      'Лента сортируется по дате публикации: новые записи всегда сверху.'
    ],
    publishedAt: new Date('2026-04-26T09:00:00.000Z')
  }
];

function parseDetails(value: any): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchUpdatesSafe(): Promise<any[]> {
  const model = (prisma as any).platformUpdate;
  if (model?.findMany) {
    return model.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });
  }
  return (prisma as any).$queryRawUnsafe(`
    SELECT id, title, description, details, publishedAt, createdAt
    FROM "PlatformUpdate"
    ORDER BY publishedAt DESC, createdAt DESC
    LIMIT 100
  `);
}

async function createUpdateSafe(input: {
  title: string;
  description: string;
  details: string[];
  publishedAt: Date;
  createdBy: string | null;
}) {
  const model = (prisma as any).platformUpdate;
  if (model?.create) {
    return model.create({ data: input });
  }
  const id = `upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const detailsJson = JSON.stringify(input.details || []);
  await (prisma as any).$executeRawUnsafe(
    `
      INSERT INTO "PlatformUpdate"
      (id, title, description, details, publishedAt, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    id,
    input.title,
    input.description,
    detailsJson,
    input.publishedAt.toISOString(),
    input.createdBy
  );
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT id, title, description, details, publishedAt FROM "PlatformUpdate" WHERE id = ? LIMIT 1`,
    id
  );
  return rows?.[0] || { id, ...input };
}

router.get('/platform/updates', requireAuth, async (_req, res) => {
  try {
    const dbItems = await fetchUpdatesSafe();
    const updates = (dbItems?.length ? dbItems : DEFAULT_UPDATES).map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      details: parseDetails(item.details),
      publishedAt: new Date(item.publishedAt).toISOString()
    }));
    res.json({ items: updates });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load platform updates' });
  }
});

router.post('/admin/platform/updates', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const detailsRaw = Array.isArray(req.body?.details) ? req.body.details : [];
    const details = detailsRaw.map((v: any) => String(v ?? '').trim()).filter(Boolean).slice(0, 12);
    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();

    if (!title || !description) {
      return res.status(400).json({ error: 'Заполните заголовок и описание обновления' });
    }
    if (Number.isNaN(publishedAt.getTime())) {
      return res.status(400).json({ error: 'Некорректная дата публикации' });
    }

    const created = await createUpdateSafe({
      title,
      description,
      details,
      publishedAt,
      createdBy: req.user?.id || null
    });
    res.status(201).json({
      item: {
        id: created.id,
        title: created.title,
        description: created.description,
        details: parseDetails(created.details),
        publishedAt: new Date(created.publishedAt).toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to publish update' });
  }
});

export default router;

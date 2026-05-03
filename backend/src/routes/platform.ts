import { Router } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth';

const router = Router();

const SEED_ID_PREFIX = 'seed-platform-';

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

function parseDetails(value: unknown): string[] {
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

function normalizeDbRow(item: any) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    details: parseDetails(item.details),
    publishedAt: new Date(item.publishedAt).toISOString(),
    isSeed: false,
    isDraft: Boolean(item.isDraft)
  };
}

/** Системные записи + опубликованные из БД, без черновиков. Новые сверху. */
function mergePublicFeed(dbPublished: any[]): ReturnType<typeof normalizeDbRow>[] {
  const seeds = DEFAULT_UPDATES.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    details: s.details,
    publishedAt: new Date(s.publishedAt).toISOString(),
    isSeed: true,
    isDraft: false
  }));
  const fromDb = dbPublished.map(normalizeDbRow);
  const combined = [...seeds, ...fromDb];
  combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return combined as ReturnType<typeof normalizeDbRow>[];
}

async function fetchPublishedFromDb(): Promise<any[]> {
  const model = (prisma as any).platformUpdate;
  if (model?.findMany) {
    return model.findMany({
      where: { isDraft: false },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200
    });
  }
  return (prisma as any).$queryRawUnsafe(`
    SELECT id, title, description, details, publishedAt, createdAt, COALESCE(isDraft, 0) as isDraft
    FROM "PlatformUpdate"
    WHERE COALESCE(isDraft, 0) = 0
    ORDER BY publishedAt DESC, createdAt DESC
    LIMIT 200
  `);
}

async function fetchDraftsFromDb(): Promise<any[]> {
  const model = (prisma as any).platformUpdate;
  if (model?.findMany) {
    return model.findMany({
      where: { isDraft: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50
    });
  }
  return (prisma as any).$queryRawUnsafe(`
    SELECT id, title, description, details, publishedAt, createdAt, updatedAt, isDraft
    FROM "PlatformUpdate"
    WHERE isDraft = 1
    ORDER BY updatedAt DESC, createdAt DESC
    LIMIT 50
  `);
}

function isSeedId(id: string): boolean {
  return id.startsWith(SEED_ID_PREFIX);
}

async function createUpdateSafe(input: {
  title: string;
  description: string;
  details: string[];
  publishedAt: Date;
  isDraft: boolean;
  createdBy: string | null;
}) {
  const model = (prisma as any).platformUpdate;
  if (model?.create) {
    return model.create({
      data: {
        title: input.title,
        description: input.description,
        details: input.details.length ? input.details : undefined,
        publishedAt: input.publishedAt,
        isDraft: input.isDraft,
        createdBy: input.createdBy ?? undefined
      }
    });
  }
  const id = `upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const detailsJson = JSON.stringify(input.details || []);
  const draftNum = input.isDraft ? 1 : 0;
  await (prisma as any).$executeRawUnsafe(
    `
      INSERT INTO "PlatformUpdate"
      (id, title, description, details, publishedAt, isDraft, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    id,
    input.title,
    input.description,
    detailsJson,
    input.publishedAt.toISOString(),
    draftNum,
    input.createdBy
  );
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT id, title, description, details, publishedAt, isDraft FROM "PlatformUpdate" WHERE id = ? LIMIT 1`,
    id
  );
  return rows?.[0] || { id, ...input };
}

async function getOneById(id: string): Promise<any | null> {
  const model = (prisma as any).platformUpdate;
  if (model?.findUnique) {
    return model.findUnique({ where: { id } });
  }
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "PlatformUpdate" WHERE id = ? LIMIT 1`,
    id
  );
  return rows?.[0] ?? null;
}

async function updateByIdSafe(
  id: string,
  data: { title?: string; description?: string; details?: string[]; publishedAt?: Date; isDraft?: boolean }
) {
  const model = (prisma as any).platformUpdate;
  const patch: any = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.details !== undefined) patch.details = data.details.length ? data.details : [];
  if (data.publishedAt !== undefined) patch.publishedAt = data.publishedAt;
  if (data.isDraft !== undefined) patch.isDraft = data.isDraft;

  if (model?.update) {
    return model.update({ where: { id }, data: patch });
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.title !== undefined) {
    sets.push('title = ?');
    vals.push(data.title);
  }
  if (data.description !== undefined) {
    sets.push('description = ?');
    vals.push(data.description);
  }
  if (data.details !== undefined) {
    sets.push('details = ?');
    vals.push(JSON.stringify(data.details));
  }
  if (data.publishedAt !== undefined) {
    sets.push('publishedAt = ?');
    vals.push(data.publishedAt.toISOString());
  }
  if (data.isDraft !== undefined) {
    sets.push('isDraft = ?');
    vals.push(data.isDraft ? 1 : 0);
  }
  if (!sets.length) return getOneById(id);
  sets.push('updatedAt = CURRENT_TIMESTAMP');
  vals.push(id);
  await (prisma as any).$executeRawUnsafe(
    `UPDATE "PlatformUpdate" SET ${sets.join(', ')} WHERE id = ?`,
    ...vals
  );
  return getOneById(id);
}

async function deleteByIdSafe(id: string) {
  const model = (prisma as any).platformUpdate;
  if (model?.delete) {
    return model.delete({ where: { id } });
  }
  await (prisma as any).$executeRawUnsafe(`DELETE FROM "PlatformUpdate" WHERE id = ?`, id);
}

router.get('/platform/updates', requireAuth, async (_req, res) => {
  try {
    const dbPublished = await fetchPublishedFromDb();
    const items = mergePublicFeed(dbPublished);
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load platform updates' });
  }
});

router.get('/admin/platform/drafts', requireAuth, requireRole(['admin']), async (_req: AuthedRequest, res) => {
  try {
    const rows = await fetchDraftsFromDb();
    const drafts = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      details: parseDetails(row.details),
      updatedAt: new Date(row.updatedAt ?? row.createdAt).toISOString(),
      publishedAt: new Date(row.publishedAt).toISOString()
    }));
    res.json({ drafts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load drafts' });
  }
});

router.post('/admin/platform/updates', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const detailsRaw = Array.isArray(req.body?.details) ? req.body.details : [];
    const details = detailsRaw.map((v: any) => String(v ?? '').trim()).filter(Boolean).slice(0, 12);
    const asDraft = Boolean(req.body?.draft);
    const publishedAt = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();

    if (!title || !description) {
      return res.status(400).json({ error: 'Заполните заголовок и текст обновления' });
    }
    if (Number.isNaN(publishedAt.getTime())) {
      return res.status(400).json({ error: 'Некорректная дата публикации' });
    }

    const created = await createUpdateSafe({
      title,
      description,
      details,
      publishedAt,
      isDraft: asDraft,
      createdBy: req.user?.id || null
    });
    res.status(201).json({
      item: {
        id: created.id,
        title: created.title,
        description: created.description,
        details: parseDetails(created.details),
        publishedAt: new Date(created.publishedAt).toISOString(),
        isDraft: Boolean(created.isDraft)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save update' });
  }
});

router.patch('/admin/platform/updates/:id', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    if (isSeedId(id)) {
      return res.status(403).json({ error: 'Системные записи нельзя изменять' });
    }
    const existing = await getOneById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : undefined;
    const description = req.body?.description !== undefined ? String(req.body.description).trim() : undefined;
    let details: string[] | undefined;
    if (Array.isArray(req.body?.details)) {
      details = req.body.details.map((v: any) => String(v ?? '').trim()).filter(Boolean).slice(0, 12);
    }

    if (title !== undefined && !title) {
      return res.status(400).json({ error: 'Заголовок не может быть пустым' });
    }
    if (description !== undefined && !description) {
      return res.status(400).json({ error: 'Текст не может быть пустым' });
    }

    const updated = await updateByIdSafe(id, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(details !== undefined ? { details } : {})
    });
    res.json({
      item: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        details: parseDetails(updated.details),
        publishedAt: new Date(updated.publishedAt).toISOString(),
        isDraft: Boolean(updated.isDraft)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update' });
  }
});

router.post('/admin/platform/updates/:id/publish', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    if (isSeedId(id)) {
      return res.status(403).json({ error: 'Системные записи нельзя публиковать' });
    }
    const existing = await getOneById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    const pub = req.body?.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (Number.isNaN(pub.getTime())) {
      return res.status(400).json({ error: 'Некорректная дата публикации' });
    }

    const updated = await updateByIdSafe(id, {
      isDraft: false,
      publishedAt: pub
    });
    res.json({
      item: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        details: parseDetails(updated.details),
        publishedAt: new Date(updated.publishedAt).toISOString(),
        isDraft: false
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to publish' });
  }
});

router.delete('/admin/platform/updates/:id', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    if (isSeedId(id)) {
      return res.status(403).json({ error: 'Системные записи нельзя удалить' });
    }
    const existing = await getOneById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    await deleteByIdSafe(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete' });
  }
});

export default router;

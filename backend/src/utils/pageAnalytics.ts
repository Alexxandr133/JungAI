import { prisma } from '../db/prisma';

let ensured = false;

export async function ensurePageAnalyticsTables() {
  if (ensured) return;
  try {
    const cols = (await (prisma as any).$queryRawUnsafe(`PRAGMA table_info("User")`)) as Array<{ name: string }>;
    const names = new Set((cols || []).map((c) => c.name));
    if (!names.has('lastSeenAt')) {
      await (prisma as any).$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "lastSeenAt" DATETIME`);
    }
  } catch (e) {
    console.warn('[pageAnalytics] ensure lastSeenAt:', (e as Error)?.message || e);
  }
  try {
    await (prisma as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserPageVisit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "pathKey" TEXT NOT NULL,
        "durationMs" INTEGER NOT NULL DEFAULT 0,
        "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await (prisma as any).$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserPageVisit_userId_startedAt_idx" ON "UserPageVisit"("userId", "startedAt")`
    );
    await (prisma as any).$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserPageVisit_pathKey_startedAt_idx" ON "UserPageVisit"("pathKey", "startedAt")`
    );
  } catch (e) {
    console.warn('[pageAnalytics] ensure UserPageVisit:', (e as Error)?.message || e);
  }
  ensured = true;
}

/** Нормализация пути: id → :id, query отбрасывается */
export function normalizePathKey(rawPath: string): string {
  let p = String(rawPath || '/').split('?')[0].split('#')[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  p = p
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/c[a-z0-9]{20,}/gi, '/:id')
    .replace(/\/[a-z]+_[a-z0-9]{10,}/gi, '/:id')
    .replace(/\/\d{6,}/g, '/:id')
    .replace(/\/room\/[^/]+/gi, '/room/:id')
    .replace(/\/publications\/post\/[^/]+/gi, '/publications/post/:id')
    .replace(/\/publications\/community\/[^/]+/gi, '/publications/community/:slug')
    .replace(/\/communities\/[^/]+/gi, '/communities/:slug')
    .replace(/\/psychologists\/[^/]+/gi, '/psychologists/:id')
    .replace(/\/clients\/[^/]+/gi, '/clients/:id')
    .replace(/\/dreams\/[^/]+/gi, '/dreams/:id')
    .replace(/\/materials\/[^/]+/gi, '/materials/:id');

  if (p.length > 160) p = p.slice(0, 160);
  return p || '/';
}

const FEATURE_LABELS: Array<{ match: RegExp | string; label: string; area: string }> = [
  { match: /^\/admin(\/|$)/, label: 'Админ-панель', area: 'admin' },
  { match: /^\/client\/ai/, label: 'ИИ-помощник (клиент)', area: 'client' },
  { match: /^\/client\/care/, label: 'Забота о себе', area: 'client' },
  { match: /^\/client\/journal/, label: 'Дневник', area: 'client' },
  { match: /^\/client\/sessions/, label: 'Сессии (клиент)', area: 'client' },
  { match: /^\/client\/progress/, label: 'Прогресс', area: 'client' },
  { match: /^\/client\/psychologists/, label: 'Мой психолог', area: 'client' },
  { match: /^\/client\/match/, label: 'Подбор психолога', area: 'client' },
  { match: /^\/client\/certificate/, label: 'Сертификат', area: 'client' },
  { match: /^\/client\/?$/, label: 'Кабинет клиента', area: 'client' },
  { match: /^\/dreams/, label: 'Сны', area: 'shared' },
  { match: /^\/communities|^\/publications/, label: 'Сообщества', area: 'shared' },
  { match: /^\/psychologist\/ai|^\/ai/, label: 'ИИ (психолог)', area: 'psychologist' },
  { match: /^\/psychologist\/handbook|^\/clients/, label: 'Клиенты / handbook', area: 'psychologist' },
  { match: /^\/events/, label: 'Календарь / события', area: 'psychologist' },
  { match: /^\/chat/, label: 'Чат', area: 'shared' },
  { match: /^\/materials/, label: 'Материалы', area: 'psychologist' },
  { match: /^\/tasks/, label: 'Задачи', area: 'psychologist' },
  { match: /^\/psychologist\/?$|^\/dashboard/, label: 'Кабинет психолога', area: 'psychologist' },
  { match: /^\/work-area|^\/psychologist\/work/, label: 'Рабочая область', area: 'psychologist' },
  { match: /^\/researcher/, label: 'Исследователь', area: 'researcher' },
  { match: /^\/match/, label: 'Публичный подбор', area: 'marketing' },
  { match: /^\/psychologists/, label: 'Каталог психологов', area: 'marketing' },
  { match: /^\/guest/, label: 'Гостевой кабинет', area: 'marketing' },
  { match: /^\/about/, label: 'О платформе', area: 'marketing' },
  { match: /^\/login|^\/register/, label: 'Вход / регистрация', area: 'auth' },
];

export function featureMeta(pathKey: string): { label: string; area: string } {
  for (const f of FEATURE_LABELS) {
    if (typeof f.match === 'string' ? pathKey.startsWith(f.match) : f.match.test(pathKey)) {
      return { label: f.label, area: f.area };
    }
  }
  return { label: pathKey, area: 'other' };
}

export function cuidLike() {
  return `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

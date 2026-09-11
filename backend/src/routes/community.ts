import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { getUploadsRoot } from '../utils/uploadsRoot';

const router = Router();

type CreateRole = 'psychologist' | 'researcher' | 'admin' | 'client';
const CREATE_ROLES: CreateRole[] = ['psychologist', 'researcher', 'admin', 'client'];
const LEGACY_SEED_COMMUNITY_SLUGS = ['therapy-methods', 'clinical-cases'];
const COMMENTS_PAGE_SIZE = 15;

const publicationsUploadDir = path.join(getUploadsRoot(), 'publications');
if (!fs.existsSync(publicationsUploadDir)) {
  fs.mkdirSync(publicationsUploadDir, { recursive: true });
}

const publicationImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, publicationsUploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `pub-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif/.test(path.extname(file.originalname || '').toLowerCase()) ||
      /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Разрешены JPG, PNG, WEBP, GIF'));
  }
});

function canCreate(role: string): boolean {
  return CREATE_ROLES.includes(role as CreateRole);
}

/** Reject huge base64 blobs — images must be uploaded as files. */
function sanitizeStoredImageUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  let value = String(raw).trim();
  if (!value) return null;
  // Legacy inline base64 — drop instead of failing the whole PATCH
  if (value.startsWith('data:') || value.startsWith('blob:')) return null;
  // Normalize absolute upload URLs to path
  const abs = value.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/i);
  if (abs) value = abs[1];
  if (value.length > 500) {
    throw Object.assign(new Error('Некорректный URL изображения'), { status: 400 });
  }
  if (value.startsWith('/uploads/') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  // Allow relative paths without scheme
  if (value.startsWith('/') && value.length < 500) return value;
  throw Object.assign(new Error('Загрузите изображение через /api/publications/upload-image'), { status: 400 });
}

function slugify(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

type ForumUserBrief = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  avatarUrl: string | null;
};

async function getUsersMap(userIds: string[]): Promise<Map<string, ForumUserBrief>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const users = await (prisma as any).user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, role: true }
  });
  const profiles = await (prisma as any).profile.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, name: true, avatarUrl: true }
  });
  const profileByUserId = new Map((profiles || []).map((p: any) => [p.userId, p]));

  // Клиенты часто хранят ФИО в Client, а Profile.name может быть пустым
  const clientEmails = (users || [])
    .filter((u: any) => u.role === 'client' && u.email)
    .map((u: any) => u.email as string);
  const clients = clientEmails.length
    ? await (prisma as any).client.findMany({
        where: { email: { in: clientEmails } },
        select: { email: true, name: true }
      })
    : [];
  const clientNameByEmail = new Map<string, string>();
  for (const c of clients || []) {
    if (!c?.email || !c?.name) continue;
    clientNameByEmail.set(String(c.email).toLowerCase(), String(c.name).trim());
  }

  const map = new Map<string, ForumUserBrief>();
  for (const u of users || []) {
    const p: any = profileByUserId.get(u.id);
    const profileName = p?.name ? String(p.name).trim() : '';
    const clientName =
      u.role === 'client' && u.email
        ? clientNameByEmail.get(String(u.email).toLowerCase()) || ''
        : '';
    map.set(u.id, {
      id: u.id,
      email: u.email,
      role: u.role,
      name: profileName || clientName || null,
      avatarUrl: p?.avatarUrl || null
    });
  }
  return map;
}

let ensuredPublicationCommentReactionsTable = false;
let ensuredPublicationPostForumColumns = false;

async function ensurePublicationPostForumColumns() {
  if (ensuredPublicationPostForumColumns) return;
  try {
    const rows = (await (prisma as any).$queryRawUnsafe(`PRAGMA table_info("PublicationPost")`)) as any[];
    const names = new Set((rows || []).map((r: any) => String(r.name)));
    if (!names.has('flair')) {
      await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PublicationPost" ADD COLUMN "flair" TEXT`);
    }
    if (!names.has('isPinned')) {
      await (prisma as any).$executeRawUnsafe(
        `ALTER TABLE "PublicationPost" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT 0`
      );
    }
  } catch (e) {
    console.warn('[community] ensure flair/isPinned:', (e as Error)?.message || e);
  }
  try {
    const commentCols = (await (prisma as any).$queryRawUnsafe(`PRAGMA table_info("PublicationComment")`)) as any[];
    const commentNames = new Set((commentCols || []).map((r: any) => String(r.name)));
    if (!commentNames.has('parentId')) {
      await (prisma as any).$executeRawUnsafe(`ALTER TABLE "PublicationComment" ADD COLUMN "parentId" TEXT`);
    }
  } catch (e) {
    console.warn('[community] ensure comment parentId:', (e as Error)?.message || e);
  }
  ensuredPublicationPostForumColumns = true;
}

async function ensurePublicationCommentReactionsTable() {
  if (ensuredPublicationCommentReactionsTable) return;
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PublicationCommentReaction" (
      "id" TEXT PRIMARY KEY,
      "commentId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'like',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await (prisma as any).$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "PublicationCommentReaction_commentId_userId_type_key"
    ON "PublicationCommentReaction"("commentId", "userId", "type");
  `);
  ensuredPublicationCommentReactionsTable = true;
}

async function getCommentReactionsCountMap(commentIds: string[]) {
  if (!commentIds.length) return new Map<string, number>();
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT commentId, COUNT(*) as cnt
     FROM "PublicationCommentReaction"
     WHERE type = 'like' AND commentId IN (${placeholders})
     GROUP BY commentId`,
    ...commentIds
  );
  return new Map((rows || []).map((r: any) => [String(r.commentId), Number(r.cnt || 0)]));
}

async function getMyCommentReactionSet(commentIds: string[], userId?: string) {
  if (!userId || !commentIds.length) return new Set<string>();
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT commentId
     FROM "PublicationCommentReaction"
     WHERE type = 'like' AND userId = ? AND commentId IN (${placeholders})`,
    userId,
    ...commentIds
  );
  return new Set((rows || []).map((r: any) => String(r.commentId)));
}

async function deleteCommentReactionsByPostIds(postIds: string[]) {
  if (!postIds.length) return;
  await ensurePublicationCommentReactionsTable();
  const placeholders = postIds.map(() => '?').join(',');
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "PublicationCommentReaction"
     WHERE commentId IN (SELECT id FROM "PublicationComment" WHERE postId IN (${placeholders}))`,
    ...postIds
  );
}

let legacyCleanupStarted = false;
async function cleanupLegacySeedCommunitiesOnce() {
  if (legacyCleanupStarted) return;
  legacyCleanupStarted = true;
  try {
    const communities = await (prisma as any).community.findMany({
      where: { slug: { in: LEGACY_SEED_COMMUNITY_SLUGS } },
      select: { id: true }
    });
    const ids = communities.map((c: any) => c.id);
    if (!ids.length) return;

    const posts = await (prisma as any).publicationPost.findMany({
      where: { communityId: { in: ids } },
      select: { id: true }
    });
    const postIds = posts.map((p: any) => p.id);
    if (postIds.length) {
      await deleteCommentReactionsByPostIds(postIds);
      await (prisma as any).publicationComment.deleteMany({ where: { postId: { in: postIds } } });
      await (prisma as any).publicationReaction.deleteMany({ where: { postId: { in: postIds } } });
    }
    await (prisma as any).publicationPost.deleteMany({ where: { communityId: { in: ids } } });
    await (prisma as any).communityMember.deleteMany({ where: { communityId: { in: ids } } });
    await (prisma as any).community.deleteMany({ where: { id: { in: ids } } });
  } catch {
    // no-op: cleanup is best-effort only
  }
}

async function communityStatsMap(communityIds: string[]) {
  const ids = Array.from(new Set(communityIds.filter(Boolean)));
  if (!ids.length) {
    return { members: new Map<string, number>(), posts: new Map<string, number>() };
  }
  const [memberGroups, postGroups] = await Promise.all([
    (prisma as any).communityMember.groupBy({
      by: ['communityId'],
      where: { communityId: { in: ids } },
      _count: { _all: true }
    }),
    (prisma as any).publicationPost.groupBy({
      by: ['communityId'],
      where: { communityId: { in: ids }, status: 'published' },
      _count: { _all: true }
    })
  ]);
  return {
    members: new Map((memberGroups || []).map((x: any) => [x.communityId, x._count._all])),
    posts: new Map((postGroups || []).map((x: any) => [x.communityId, x._count._all]))
  };
}

async function serializeCommunities(
  rows: any[],
  viewerUserId?: string
): Promise<any[]> {
  const ids = rows.map((c) => c.id);
  const stats = await communityStatsMap(ids);
  const memberships = viewerUserId && ids.length
    ? await (prisma as any).communityMember.findMany({
        where: { userId: viewerUserId, communityId: { in: ids } },
        select: { communityId: true, role: true }
      })
    : [];
  const memberMap = new Map((memberships || []).map((m: any) => [m.communityId, m.role]));
  return rows.map((c) => ({
    ...c,
    membersCount: stats.members.get(c.id) || 0,
    postsCount: stats.posts.get(c.id) || 0,
    isSubscribed: memberMap.has(c.id),
    currentRole: memberMap.get(c.id) || null
  }));
}

async function canPostAsCommunity(userId: string, role: string, communityId: string) {
  if (role === 'admin') return true;
  const member = await (prisma as any).communityMember.findFirst({
    where: { communityId, userId }
  });
  return Boolean(member && ['owner', 'moderator'].includes(member.role));
}

async function getMembershipRole(userId: string, communityId: string): Promise<string | null> {
  const member = await (prisma as any).communityMember.findFirst({
    where: { communityId, userId },
    select: { role: true }
  });
  return member?.role || null;
}

async function canModerateCommunity(userId: string, role: string, communityId: string | null | undefined) {
  if (!communityId) return role === 'admin';
  if (role === 'admin') return true;
  const membership = await getMembershipRole(userId, communityId);
  return membership === 'owner' || membership === 'moderator';
}

async function isCommunityMember(userId: string, communityId: string) {
  const membership = await getMembershipRole(userId, communityId);
  return Boolean(membership);
}

async function buildFeed(params: {
  communityId?: string;
  authorId?: string;
  viewerUserId?: string;
  sort?: 'new' | 'active' | 'top';
  flair?: string;
  scope?: 'all' | 'subs' | 'mine';
  pinnedFirst?: boolean;
  take?: number;
}) {
  await ensurePublicationPostForumColumns();
  const sort = params.sort === 'active' || params.sort === 'top' ? params.sort : 'new';
  const where: any = { status: 'published' };
  if (params.communityId) where.communityId = params.communityId;
  if (params.authorId) where.authorId = params.authorId;
  if (params.flair) where.flair = params.flair;
  if (params.scope === 'mine' && params.viewerUserId && !params.authorId) {
    where.authorId = params.viewerUserId;
  }
  if (params.scope === 'subs' && params.viewerUserId && !params.communityId) {
    const memberships = await (prisma as any).communityMember.findMany({
      where: { userId: params.viewerUserId },
      select: { communityId: true }
    });
    const ids = (memberships || []).map((m: any) => m.communityId);
    where.communityId = { in: ids.length ? ids : ['__none__'] };
  }

  let posts = await (prisma as any).publicationPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  const usersMap = await getUsersMap(posts.map((p: any) => p.authorId));
  const communityIds = Array.from(new Set(posts.map((p: any) => p.communityId).filter(Boolean)));
  const communities = communityIds.length
    ? await (prisma as any).community.findMany({
        where: { id: { in: communityIds } },
        select: { id: true, name: true, slug: true, avatarUrl: true }
      })
    : [];
  const communityMap = new Map((communities || []).map((c: any) => [c.id, c]));

  const postIds = posts.map((p: any) => p.id);
  const comments = postIds.length
    ? await (prisma as any).publicationComment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { _all: true }
      })
    : [];
  const lastComments = postIds.length
    ? await (prisma as any).publicationComment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _max: { createdAt: true }
      })
    : [];
  const reactions = postIds.length
    ? await (prisma as any).publicationReaction.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { _all: true }
      })
    : [];
  const commentsCountMap = new Map((comments || []).map((x: any) => [x.postId, x._count._all]));
  const lastActiveMap = new Map(
    (lastComments || []).map((x: any) => [x.postId, x._max?.createdAt ? new Date(x._max.createdAt).getTime() : 0])
  );
  const reactionsCountMap = new Map((reactions || []).map((x: any) => [x.postId, x._count._all]));
  const myReactions =
    params.viewerUserId && postIds.length
      ? await (prisma as any).publicationReaction.findMany({
          where: { postId: { in: postIds }, userId: params.viewerUserId, type: 'like' },
          select: { postId: true }
        })
      : [];
  const myReactionsSet = new Set((myReactions || []).map((r: any) => r.postId));

  let viewerRole = '';
  const staffCommunityIds = new Set<string>();
  if (params.viewerUserId) {
    const viewer = await prisma.user.findUnique({
      where: { id: params.viewerUserId },
      select: { role: true }
    });
    viewerRole = viewer?.role || '';
    if (viewerRole !== 'admin') {
      const staff = await (prisma as any).communityMember.findMany({
        where: { userId: params.viewerUserId, role: { in: ['owner', 'moderator'] } },
        select: { communityId: true }
      });
      for (const row of staff || []) staffCommunityIds.add(String(row.communityId));
    }
  }

  let items = posts.map((p: any) => ({
    ...p,
    flair: p.flair && String(p.flair).trim() ? p.flair : 'Пост',
    isPinned: Boolean(p.isPinned),
    author: usersMap.get(p.authorId) || null,
    community: p.communityId ? communityMap.get(p.communityId) || null : null,
    commentsCount: commentsCountMap.get(p.id) || 0,
    reactionsCount: reactionsCountMap.get(p.id) || 0,
    likedByMe: myReactionsSet.has(p.id),
    canPin: Boolean(
      params.viewerUserId &&
        p.communityId &&
        (viewerRole === 'admin' || staffCommunityIds.has(p.communityId))
    ),
    canDelete: Boolean(
      params.viewerUserId &&
        (viewerRole === 'admin' ||
          p.authorId === params.viewerUserId ||
          (p.communityId && staffCommunityIds.has(p.communityId)))
    ),
    lastActiveAt: lastActiveMap.get(p.id) || new Date(p.createdAt).getTime()
  }));

  if (sort === 'top') {
    items.sort(
      (a: any, b: any) =>
        (b.reactionsCount || 0) - (a.reactionsCount || 0) ||
        (b.commentsCount || 0) - (a.commentsCount || 0) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sort === 'active') {
    items.sort(
      (a: any, b: any) =>
        (b.lastActiveAt || 0) - (a.lastActiveAt || 0) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  if (params.pinnedFirst) {
    items.sort((a: any, b: any) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
  }

  const take = params.take ?? 50;
  return items.slice(0, take).map(({ lastActiveAt: _last, ...rest }: any) => rest);
}

async function getCommunityMembers(communityId: string) {
  const members = await (prisma as any).communityMember.findMany({
    where: { communityId },
    orderBy: { joinedAt: 'asc' }
  });
  const usersMap = await getUsersMap((members || []).map((m: any) => m.userId));
  return (members || []).map((m: any) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    user: usersMap.get(m.userId) || null
  }));
}

async function serializeComments(comments: any[], viewerUserId?: string) {
  const commentsUsersMap = await getUsersMap(comments.map((c: any) => c.authorId));
  const commentIds = comments.map((c: any) => c.id);
  const commentReactionsCountMap = await getCommentReactionsCountMap(commentIds);
  const myCommentReactionSet = await getMyCommentReactionSet(commentIds, viewerUserId);
  return comments.map((c: any) => ({
    ...c,
    parentId: c.parentId || null,
    author: commentsUsersMap.get(c.authorId) || null,
    reactionsCount: commentReactionsCountMap.get(c.id) || 0,
    likedByMe: myCommentReactionSet.has(c.id)
  }));
}

async function loadCommentsPage(
  postId: string,
  viewerUserId: string | undefined,
  offset = 0,
  limit = COMMENTS_PAGE_SIZE
) {
  await ensurePublicationPostForumColumns();
  const take = Math.min(Math.max(limit, 1), 40);
  const skip = Math.max(offset, 0);
  const roots = await (prisma as any).publicationComment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: 'desc' },
    skip,
    take
  });
  const totalRoots = await (prisma as any).publicationComment.count({
    where: { postId, parentId: null }
  });
  let frontier = roots.map((r: any) => r.id);
  const descendants: any[] = [];
  let guard = 0;
  while (frontier.length && guard++ < 12) {
    const children = await (prisma as any).publicationComment.findMany({
      where: { postId, parentId: { in: frontier } },
      orderBy: { createdAt: 'asc' }
    });
    if (!children.length) break;
    descendants.push(...children);
    frontier = children.map((c: any) => c.id);
  }
  const comments = await serializeComments([...roots, ...descendants], viewerUserId);
  return {
    comments,
    totalRoots,
    offset: skip,
    limit: take,
    hasMore: skip + roots.length < totalRoots
  };
}

async function getPublicPostDetails(postId: string, viewerUserId?: string, allowOwnDraft = false) {
  await ensurePublicationCommentReactionsTable();
  await ensurePublicationPostForumColumns();
  const post = await (prisma as any).publicationPost.findUnique({ where: { id: postId } });
  if (!post) return null;
  if (post.status !== 'published') {
    if (!allowOwnDraft || !viewerUserId || post.authorId !== viewerUserId) return null;
  }
  const usersMap = await getUsersMap([post.authorId]);
  const reactionsCount = await (prisma as any).publicationReaction.count({ where: { postId } });
  const commentsCount = await (prisma as any).publicationComment.count({ where: { postId } });
  const community = post.communityId
    ? await (prisma as any).community.findUnique({
        where: { id: post.communityId },
        select: { id: true, slug: true, name: true, avatarUrl: true, coverUrl: true }
      })
    : null;
  const likedByMe = Boolean(
    viewerUserId &&
      (await (prisma as any).publicationReaction.findFirst({
        where: { postId, userId: viewerUserId, type: 'like' },
        select: { id: true }
      }))
  );
  let canPin = false;
  let canModerate = false;
  if (viewerUserId) {
    const viewer = await prisma.user.findUnique({ where: { id: viewerUserId }, select: { role: true } });
    const viewerRole = viewer?.role || '';
    canModerate = await canModerateCommunity(viewerUserId, viewerRole, post.communityId);
    // Pin only inside a community, only for owner/moderator/admin
    canPin = Boolean(post.communityId && canModerate);
  }
  const canDelete = Boolean(viewerUserId && (post.authorId === viewerUserId || canModerate));
  const page = await loadCommentsPage(postId, viewerUserId, 0, COMMENTS_PAGE_SIZE);

  return {
    ...post,
    flair: post.flair && String(post.flair).trim() ? post.flair : 'Пост',
    author: usersMap.get(post.authorId) || null,
    comments: page.comments,
    commentsCount,
    commentsTotalRoots: page.totalRoots,
    commentsHasMore: page.hasMore,
    community,
    reactionsCount,
    likedByMe,
    canPin,
    canDelete,
    canModerate
  };
}

router.get('/public/publications/discovery', async (_req, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    await ensurePublicationPostForumColumns();
    const items = await buildFeed({});
    const rows = await (prisma as any).community.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const communities = await serializeCommunities(rows || []);
    res.json({
      items,
      communities
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load discovery' });
  }
});

router.get('/public/publications/posts/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const item = await getPublicPostDetails(id);
    if (!item) return res.status(404).json({ error: 'Post not found' });
    res.json({ item });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load post' });
  }
});

router.get('/communities', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    await ensurePublicationPostForumColumns();
    const rows = await (prisma as any).community.findMany({ orderBy: { createdAt: 'desc' } });
    const items = await serializeCommunities(rows || [], req.user?.id);
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load communities' });
  }
});

router.post('/communities', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const avatarUrl = sanitizeStoredImageUrl(req.body?.avatarUrl);
    const coverUrl = sanitizeStoredImageUrl(req.body?.coverUrl);
    if (!name || !description) return res.status(400).json({ error: 'Название и описание обязательны' });
    const baseSlug = slugify(req.body?.slug || name);
    if (!baseSlug) return res.status(400).json({ error: 'Некорректный slug' });

    let slug = baseSlug;
    let i = 1;
    while (await (prisma as any).community.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const community = await (prisma as any).community.create({
      data: { name, slug, description, avatarUrl, coverUrl, ownerId: req.user!.id }
    });
    await (prisma as any).communityMember.create({
      data: { communityId: community.id, userId: req.user!.id, role: 'owner' }
    });
    res.status(201).json({ item: community });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e.message || 'Failed to create community' });
  }
});

router.get('/communities/:slug', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await ensurePublicationPostForumColumns();
    const slug = String(req.params.slug || '');
    const sortRaw = String(req.query.sort || 'new');
    const sort = sortRaw === 'active' || sortRaw === 'top' ? sortRaw : 'new';
    const flair = req.query.flair ? String(req.query.flair) : undefined;
    const community = await (prisma as any).community.findFirst({ where: { slug } });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    const postsCount = await (prisma as any).publicationPost.count({
      where: { communityId: community.id, status: 'published' }
    });
    const membersCount = await (prisma as any).communityMember.count({ where: { communityId: community.id } });
    const members = await getCommunityMembers(community.id);
    const currentMembership = members.find((m: any) => m.userId === req.user!.id) || null;
    const posts = await buildFeed({
      communityId: community.id,
      viewerUserId: req.user!.id,
      sort,
      flair,
      pinnedFirst: true,
      take: 50
    });
    const flairRows = await (prisma as any).publicationPost.findMany({
      where: { communityId: community.id, status: 'published', NOT: { flair: null } },
      select: { flair: true }
    });
    const flairs = Array.from(
      new Set((flairRows || []).map((r: any) => r.flair).filter(Boolean))
    );
    const moderators = members.filter((m: any) => m.role === 'owner' || m.role === 'moderator');
    res.json({
      community: {
        ...community,
        postsCount,
        membersCount,
        isSubscribed: !!currentMembership,
        currentRole: currentMembership?.role || null
      },
      members,
      moderators,
      flairs,
      posts
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load community' });
  }
});

router.post('/communities/:id/subscription', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const communityId = String(req.params.id || '');
    const community = await (prisma as any).community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const existing = await (prisma as any).communityMember.findFirst({
      where: { communityId, userId: req.user!.id }
    });
    if (existing) {
      if (existing.role === 'owner') return res.status(400).json({ error: 'Владелец не может отписаться' });
      await (prisma as any).communityMember.delete({ where: { id: existing.id } });
      return res.json({ subscribed: false });
    }
    await (prisma as any).communityMember.create({
      data: { communityId, userId: req.user!.id, role: 'member' }
    });
    return res.json({ subscribed: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update subscription' });
  }
});

router.patch('/communities/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const isAdmin = req.user!.role === 'admin';
    const member = await (prisma as any).communityMember.findFirst({
      where: { communityId: id, userId: req.user!.id }
    });
    if (!isAdmin && (!member || !['owner', 'moderator'].includes(member.role))) {
      return res.status(403).json({ error: 'Недостаточно прав на управление сообществом' });
    }
    const patch: any = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim();
    if (req.body?.avatarUrl !== undefined) patch.avatarUrl = sanitizeStoredImageUrl(req.body.avatarUrl);
    if (req.body?.coverUrl !== undefined) patch.coverUrl = sanitizeStoredImageUrl(req.body.coverUrl);
    if (req.body?.slug !== undefined) {
      const nextSlug = slugify(req.body.slug);
      if (!nextSlug) return res.status(400).json({ error: 'Некорректный slug' });
      const duplicate = await (prisma as any).community.findFirst({ where: { slug: nextSlug, id: { not: id } } });
      if (duplicate) return res.status(400).json({ error: 'Slug уже занят' });
      patch.slug = nextSlug;
    }
    const updated = await (prisma as any).community.update({ where: { id }, data: patch });
    res.json({ item: updated });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e.message || 'Failed to update community' });
  }
});

router.get('/communities/id/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const community = await (prisma as any).community.findUnique({ where: { id } });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    const [serialized] = await serializeCommunities([community], req.user!.id);
    const members = await getCommunityMembers(id);
    const canManage =
      req.user!.role === 'admin' ||
      serialized.currentRole === 'owner' ||
      serialized.currentRole === 'moderator';
    if (!canManage) return res.status(403).json({ error: 'Недостаточно прав' });
    res.json({ community: serialized, members });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load community' });
  }
});

router.patch('/communities/:id/members/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const communityId = String(req.params.id || '');
    const targetUserId = String(req.params.userId || '');
    const nextRole = String(req.body?.role || '').trim();
    if (!['member', 'moderator'].includes(nextRole)) {
      return res.status(400).json({ error: 'Роль: member или moderator' });
    }
    const actorRole =
      req.user!.role === 'admin'
        ? 'owner'
        : await getMembershipRole(req.user!.id, communityId);
    if (actorRole !== 'owner' && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Назначать роли может только владелец' });
    }
    const target = await (prisma as any).communityMember.findFirst({
      where: { communityId, userId: targetUserId }
    });
    if (!target) return res.status(404).json({ error: 'Участник не найден' });
    if (target.role === 'owner') return res.status(400).json({ error: 'Нельзя менять роль владельца' });
    const updated = await (prisma as any).communityMember.update({
      where: { id: target.id },
      data: { role: nextRole }
    });
    res.json({ item: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update member' });
  }
});

router.delete('/communities/:id/members/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const communityId = String(req.params.id || '');
    const targetUserId = String(req.params.userId || '');
    const actorIsAdmin = req.user!.role === 'admin';
    const actorRole = actorIsAdmin ? 'owner' : await getMembershipRole(req.user!.id, communityId);
    if (actorRole !== 'owner' && actorRole !== 'moderator') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    const target = await (prisma as any).communityMember.findFirst({
      where: { communityId, userId: targetUserId }
    });
    if (!target) return res.status(404).json({ error: 'Участник не найден' });
    if (target.role === 'owner') return res.status(400).json({ error: 'Нельзя удалить владельца' });
    if (target.role === 'moderator' && actorRole !== 'owner' && !actorIsAdmin) {
      return res.status(403).json({ error: 'Модератора может удалить только владелец' });
    }
    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: 'Нельзя удалить себя — отпишитесь из сообщества' });
    }
    await (prisma as any).communityMember.delete({ where: { id: target.id } });
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to remove member' });
  }
});

router.delete('/communities/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const community = await (prisma as any).community.findUnique({ where: { id } });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    const member = await (prisma as any).communityMember.findFirst({ where: { communityId: id, userId: req.user!.id } });
    const canDelete = req.user!.role === 'admin' || member?.role === 'owner';
    if (!canDelete) return res.status(403).json({ error: 'Недостаточно прав на удаление сообщества' });

    const posts = await (prisma as any).publicationPost.findMany({
      where: { communityId: id },
      select: { id: true }
    });
    const postIds = posts.map((p: any) => p.id);
    if (postIds.length) {
      await deleteCommentReactionsByPostIds(postIds);
      await (prisma as any).publicationComment.deleteMany({ where: { postId: { in: postIds } } });
      await (prisma as any).publicationReaction.deleteMany({ where: { postId: { in: postIds } } });
    }
    await (prisma as any).publicationPost.deleteMany({ where: { communityId: id } });
    await (prisma as any).communityMember.deleteMany({ where: { communityId: id } });
    await (prisma as any).community.delete({ where: { id } });
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete community' });
  }
});

router.get('/publications/feed', requireAuth, async (req, res) => {
  try {
    const communityId = req.query.communityId ? String(req.query.communityId) : undefined;
    const authorId = req.query.authorId ? String(req.query.authorId) : undefined;
    const sortRaw = String(req.query.sort || 'new');
    const sort = sortRaw === 'active' || sortRaw === 'top' ? sortRaw : 'new';
    const flair = req.query.flair ? String(req.query.flair) : undefined;
    const scopeRaw = String(req.query.scope || 'all');
    const scope = scopeRaw === 'subs' || scopeRaw === 'mine' ? scopeRaw : 'all';
    const items = await buildFeed({
      communityId,
      authorId,
      viewerUserId: (req as AuthedRequest).user?.id,
      sort,
      flair,
      scope,
      pinnedFirst: Boolean(communityId)
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feed' });
  }
});

router.get('/publications/discovery', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    await ensurePublicationPostForumColumns();
    const viewerId = req.user?.id;
    const rows = await (prisma as any).community.findMany({ orderBy: { createdAt: 'desc' } });
    const communities = await serializeCommunities(rows || [], viewerId);
    const isStaff = (c: any) => c.currentRole === 'owner' || c.currentRole === 'moderator';
    const managed = communities.filter((c: any) => isStaff(c));
    const subscriptions = communities.filter((c: any) => c.isSubscribed && !isStaff(c));
    const recommended = communities.filter((c: any) => !c.isSubscribed).slice(0, 8);
    res.json({
      communities,
      managed,
      subscriptions,
      recommended,
      // legacy alias: old clients treated mine as all subscriptions
      mine: [...managed, ...subscriptions]
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load discovery' });
  }
});

router.get('/publications/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    await ensurePublicationPostForumColumns();
    const ownPosts = await (prisma as any).publicationPost.findMany({
      where: { authorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    const usersMap = await getUsersMap([req.user!.id]);
    const communityIds = Array.from(new Set((ownPosts || []).map((p: any) => p.communityId).filter(Boolean)));
    const communitiesMap = new Map(
      (
        communityIds.length
          ? await (prisma as any).community.findMany({ where: { id: { in: communityIds } }, select: { id: true, slug: true, name: true, avatarUrl: true } })
          : []
      ).map((c: any) => [c.id, c])
    );
    const postIds = ownPosts.map((p: any) => p.id);
    const commentCountRows = postIds.length
      ? await (prisma as any).publicationComment.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } })
      : [];
    const commentsMap = new Map((commentCountRows || []).map((x: any) => [x.postId, x._count._all]));
    const posts = ownPosts.map((p: any) => ({
      ...p,
      author: usersMap.get(p.authorId) || null,
      community: p.communityId ? communitiesMap.get(p.communityId) || null : null,
      commentsCount: commentsMap.get(p.id) || 0
    }));
    const owned = await (prisma as any).community.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });
    const memberships = await (prisma as any).communityMember.findMany({
      where: { userId: req.user!.id },
      select: { communityId: true }
    });
    const ids = Array.from(new Set((memberships || []).map((m: any) => m.communityId)));
    const joined = ids.length
      ? await (prisma as any).community.findMany({
          where: { id: { in: ids }, ownerId: { not: req.user!.id } },
          orderBy: { createdAt: 'desc' }
        })
      : [];
    const comments = await (prisma as any).publicationComment.findMany({
      where: { authorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const commentedPostIds = Array.from(new Set((comments || []).map((c: any) => c.postId)));
    const commentedPosts = commentedPostIds.length
      ? await (prisma as any).publicationPost.findMany({
          where: { id: { in: commentedPostIds } },
          select: { id: true, title: true, communityId: true, status: true }
        })
      : [];
    const commentedMap = new Map((commentedPosts || []).map((p: any) => [p.id, p]));
    res.json({
      posts,
      comments: (comments || []).map((c: any) => ({
        ...c,
        post: commentedMap.get(c.postId) || null
      })),
      communities: [...owned, ...joined]
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load personal publications' });
  }
});

router.post('/publications/posts', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const imageUrl = sanitizeStoredImageUrl(req.body?.imageUrl);
    const communityId = req.body?.communityId ? String(req.body.communityId) : null;
    const authorMode = req.body?.authorMode === 'community' ? 'community' : 'account';
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    const flair = req.body?.flair ? String(req.body.flair).trim().slice(0, 40) : null;
    if (!title || !content) return res.status(400).json({ error: 'Заполните заголовок и текст' });
    await ensurePublicationPostForumColumns();
    if (communityId) {
      const c = await (prisma as any).community.findUnique({ where: { id: communityId } });
      if (!c) return res.status(404).json({ error: 'Сообщество не найдено' });
      const memberOk =
        req.user!.role === 'admin' || (await isCommunityMember(req.user!.id, communityId));
      if (!memberOk) {
        return res.status(403).json({ error: 'Публиковать можно только в сообществах, где вы участник' });
      }
      if (authorMode === 'community') {
        const allowed = await canPostAsCommunity(req.user!.id, req.user!.role, communityId);
        if (!allowed) {
          return res.status(403).json({ error: 'От лица сообщества могут писать владелец и модераторы' });
        }
      }
    } else if (authorMode === 'community') {
      return res.status(400).json({ error: 'Для публикации от лица сообщества выберите сообщество' });
    }
    let post: any;
    const createData: any = { title, content, imageUrl, communityId, authorId: req.user!.id, authorMode, status, flair };
    try {
      post = await (prisma as any).publicationPost.create({ data: createData });
    } catch (createError: any) {
      const createMessage = String(createError?.message || '');
      if (
        createMessage.includes('Unknown argument `imageUrl`') ||
        createMessage.includes('Unknown argument `authorMode`') ||
        createMessage.includes('Unknown argument `flair`')
      ) {
        const fallback: any = { title, content, communityId, authorId: req.user!.id, status };
        if (!createMessage.includes('Unknown argument `imageUrl`')) fallback.imageUrl = imageUrl;
        if (!createMessage.includes('Unknown argument `authorMode`')) fallback.authorMode = authorMode;
        post = await (prisma as any).publicationPost.create({ data: fallback });
      } else {
        throw createError;
      }
    }
    const usersMap = await getUsersMap([post.authorId]);
    res.status(201).json({ item: { ...post, author: usersMap.get(post.authorId) || null } });
  } catch (e: any) {
    res.status(e?.status || 500).json({ error: e.message || 'Failed to create post' });
  }
});

router.patch('/publications/posts/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const isAuthor = post.authorId === req.user!.id || req.user!.role === 'admin';
    const patch: any = {};
    if (req.body?.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body?.content !== undefined) patch.content = String(req.body.content).trim();
    if (req.body?.imageUrl !== undefined) patch.imageUrl = sanitizeStoredImageUrl(req.body.imageUrl);
    if (req.body?.authorMode !== undefined) patch.authorMode = req.body.authorMode === 'community' ? 'community' : 'account';
    if (req.body?.status !== undefined) patch.status = req.body.status === 'published' ? 'published' : 'draft';
    if (req.body?.flair !== undefined) patch.flair = req.body.flair ? String(req.body.flair).trim().slice(0, 40) : null;
    if (req.body?.communityId !== undefined) patch.communityId = req.body.communityId ? String(req.body.communityId) : null;
    if (req.body?.isPinned !== undefined) {
      const communityId = patch.communityId !== undefined ? patch.communityId : post.communityId;
      if (!communityId) return res.status(400).json({ error: 'Закрепить можно только тред в сообществе' });
      const allowed = await canPostAsCommunity(req.user!.id, req.user!.role, communityId);
      if (!allowed) return res.status(403).json({ error: 'Закреплять могут владелец и модераторы' });
      patch.isPinned = Boolean(req.body.isPinned);
    }
    const keys = Object.keys(patch);
    if (!keys.length) return res.status(400).json({ error: 'Нет полей для обновления' });
    if (!isAuthor && (keys.length !== 1 || keys[0] !== 'isPinned')) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    await ensurePublicationPostForumColumns();
    const updated = await (prisma as any).publicationPost.update({ where: { id }, data: patch });
    res.json({ item: updated });
  } catch (e: any) {
    const updateMessage = String(e?.message || '');
    if (updateMessage.includes('Unknown argument `imageUrl`') || updateMessage.includes('Unknown argument `authorMode`')) {
      const id = String(req.params.id || '');
      const patch: any = {};
      if (req.body?.title !== undefined) patch.title = String(req.body.title).trim();
      if (req.body?.content !== undefined) patch.content = String(req.body.content).trim();
      if (req.body?.status !== undefined) patch.status = req.body.status === 'published' ? 'published' : 'draft';
      const updated = await (prisma as any).publicationPost.update({ where: { id }, data: patch });
      return res.json({ item: updated });
    }
    res.status(e?.status || 500).json({ error: e.message || 'Failed to update post' });
  }
});

router.post('/publications/posts/:id/publish', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.user!.id && req.user!.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    const updated = await (prisma as any).publicationPost.update({ where: { id }, data: { status: 'published' } });
    res.json({ item: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to publish post' });
  }
});

router.delete('/publications/posts/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const isAuthor = post.authorId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isMod = await canModerateCommunity(req.user!.id, req.user!.role, post.communityId);
    if (!isAuthor && !isAdmin && !isMod) return res.status(403).json({ error: 'Нет доступа' });
    await deleteCommentReactionsByPostIds([id]);
    await (prisma as any).publicationComment.deleteMany({ where: { postId: id } });
    await (prisma as any).publicationReaction.deleteMany({ where: { postId: id } });
    await (prisma as any).publicationPost.delete({ where: { id } });
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete post' });
  }
});

router.get('/publications/posts/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const item = await getPublicPostDetails(id, req.user!.id, true);
    if (!item) return res.status(404).json({ error: 'Post not found' });
    const myReaction = await (prisma as any).publicationReaction.findFirst({
      where: { postId: id, userId: req.user!.id, type: 'like' }
    });
    res.json({
      item: {
        ...item,
        likedByMe: !!myReaction
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load post' });
  }
});

router.post(
  '/publications/upload-image',
  requireAuth,
  (req: AuthedRequest, res, next) => {
    publicationImageUpload.single('image')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    try {
      if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
      if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
      const url = `/uploads/publications/${req.file.filename}`;
      res.status(201).json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to upload image' });
    }
  }
);

router.get('/publications/posts/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id }, select: { id: true, status: true, authorId: true } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (
      post.status !== 'published' &&
      post.authorId !== req.user!.id &&
      req.user!.role !== 'admin'
    ) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const offset = Number(req.query.offset || 0) || 0;
    const limit = Number(req.query.limit || COMMENTS_PAGE_SIZE) || COMMENTS_PAGE_SIZE;
    const page = await loadCommentsPage(id, req.user!.id, offset, limit);
    res.json(page);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load comments' });
  }
});

router.get('/public/publications/posts/:id/comments', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!post || post.status !== 'published') return res.status(404).json({ error: 'Post not found' });
    const offset = Number(req.query.offset || 0) || 0;
    const limit = Number(req.query.limit || COMMENTS_PAGE_SIZE) || COMMENTS_PAGE_SIZE;
    const page = await loadCommentsPage(id, undefined, offset, limit);
    res.json(page);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load comments' });
  }
});

router.post('/publications/posts/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    await ensurePublicationPostForumColumns();
    const id = String(req.params.id || '');
    const content = String(req.body?.content || '').trim();
    const parentId = String(req.body?.parentId || '').trim();
    if (!content) return res.status(400).json({ error: 'Ответ пустой' });
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    let resolvedParentId: string | null = null;
    const resolvedContent = content;
    if (parentId) {
      const parent = await (prisma as any).publicationComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== post.id) {
        return res.status(400).json({ error: 'Родительский ответ не найден' });
      }
      // Allow nested thread branches (cap depth ~8)
      let depth = 1;
      let cursor: any = parent;
      while (cursor?.parentId && depth < 8) {
        cursor = await (prisma as any).publicationComment.findUnique({
          where: { id: cursor.parentId },
          select: { id: true, parentId: true }
        });
        depth += 1;
      }
      if (depth >= 8) {
        return res.status(400).json({ error: 'Слишком глубокая ветка ответов' });
      }
      resolvedParentId = parent.id;
    }
    let comment: any;
    try {
      comment = await (prisma as any).publicationComment.create({
        data: { postId: id, authorId: req.user!.id, content: resolvedContent, parentId: resolvedParentId }
      });
    } catch (createError: any) {
      const msg = String(createError?.message || '');
      if (msg.includes('Unknown argument `parentId`')) {
        comment = await (prisma as any).publicationComment.create({
          data: { postId: id, authorId: req.user!.id, content: resolvedContent }
        });
      } else {
        throw createError;
      }
    }
    const usersMap = await getUsersMap([comment.authorId]);
    res.status(201).json({
      item: { ...comment, parentId: comment.parentId || resolvedParentId, author: usersMap.get(comment.authorId) || null }
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create comment' });
  }
});

router.delete('/publications/comments/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const comment = await (prisma as any).publicationComment.findUnique({ where: { id } });
    if (!comment) return res.status(404).json({ error: 'Ответ не найден' });
    const post = await (prisma as any).publicationPost.findUnique({
      where: { id: comment.postId },
      select: { id: true, communityId: true, authorId: true }
    });
    const isAuthor = comment.authorId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const isMod = await canModerateCommunity(req.user!.id, req.user!.role, post?.communityId);
    if (!isAuthor && !isAdmin && !isMod) return res.status(403).json({ error: 'Нет доступа' });

    // Collect subtree ids
    const toDelete = [id];
    let frontier = [id];
    let guard = 0;
    while (frontier.length && guard++ < 12) {
      const children = await (prisma as any).publicationComment.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true }
      });
      if (!children.length) break;
      const ids = children.map((c: any) => c.id);
      toDelete.push(...ids);
      frontier = ids;
    }
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM "PublicationCommentReaction" WHERE commentId IN (${toDelete.map(() => '?').join(',')})`,
      ...toDelete
    );
    await (prisma as any).publicationComment.deleteMany({ where: { id: { in: toDelete } } });
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete comment' });
  }
});

router.post('/publications/comments/:id/reactions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await ensurePublicationCommentReactionsTable();
    const id = String(req.params.id || '');
    const type = String(req.body?.type || 'like').trim() || 'like';
    const comment = await (prisma as any).publicationComment.findUnique({ where: { id } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const existingRows = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM "PublicationCommentReaction" WHERE commentId = ? AND userId = ? AND type = ? LIMIT 1`,
      id,
      req.user!.id,
      type
    );
    const existing = (existingRows || [])[0] as any;
    if (existing?.id) {
      await (prisma as any).$executeRawUnsafe(`DELETE FROM "PublicationCommentReaction" WHERE id = ?`, String(existing.id));
      const countRows = await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "PublicationCommentReaction" WHERE commentId = ? AND type = ?`,
        id,
        type
      );
      const count = Number((countRows || [])[0]?.cnt || 0);
      return res.json({ active: false, reactionsCount: count });
    }

    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO "PublicationCommentReaction"(id, commentId, userId, type) VALUES (?, ?, ?, ?)`,
      `pcr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      id,
      req.user!.id,
      type
    );
    const countRows = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "PublicationCommentReaction" WHERE commentId = ? AND type = ?`,
      id,
      type
    );
    const count = Number((countRows || [])[0]?.cnt || 0);
    res.json({ active: true, reactionsCount: count });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to toggle comment reaction' });
  }
});

router.post('/publications/posts/:id/reactions', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const type = String(req.body?.type || 'like').trim() || 'like';
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const exists = await (prisma as any).publicationReaction.findFirst({
      where: { postId: id, userId: req.user!.id, type }
    });
    if (exists) {
      await (prisma as any).publicationReaction.delete({ where: { id: exists.id } });
      const count = await (prisma as any).publicationReaction.count({ where: { postId: id } });
      return res.json({ active: false, reactionsCount: count });
    }
    await (prisma as any).publicationReaction.create({
      data: { postId: id, userId: req.user!.id, type }
    });
    const count = await (prisma as any).publicationReaction.count({ where: { postId: id } });
    res.json({ active: true, reactionsCount: count });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to toggle reaction' });
  }
});

// Legacy compatibility endpoints
router.get('/community/feed', requireAuth, async (req, res) => {
  try {
    const items = await buildFeed({ viewerUserId: (req as AuthedRequest).user?.id });
    res.json({ feed: items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feed' });
  }
});

router.get('/community/events', requireAuth, (_req, res) => {
  res.json({ events: [] });
});

router.get('/community/courses', requireAuth, (_req, res) => {
  res.json({ courses: [] });
});

export default router;

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();

type CreateRole = 'psychologist' | 'researcher' | 'admin';
const CREATE_ROLES: CreateRole[] = ['psychologist', 'researcher', 'admin'];
const LEGACY_SEED_COMMUNITY_SLUGS = ['therapy-methods', 'clinical-cases'];

function canCreate(role: string): boolean {
  return CREATE_ROLES.includes(role as CreateRole);
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

async function getUsersMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map<string, { id: string; email: string; role: string; name: string | null; avatarUrl: string | null }>();
  const users = await (prisma as any).user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, role: true }
  });
  const profiles = await (prisma as any).profile.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, name: true, avatarUrl: true }
  });
  const profileByUserId = new Map((profiles || []).map((p: any) => [p.userId, p]));
  return new Map(
    (users || []).map((u: any) => {
      const p: any = profileByUserId.get(u.id);
      return [u.id, { id: u.id, email: u.email, role: u.role, name: p?.name || null, avatarUrl: p?.avatarUrl || null }];
    })
  );
}

let ensuredPublicationCommentReactionsTable = false;
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

async function buildFeed(params: { communityId?: string; authorId?: string; viewerUserId?: string }) {
  const where: any = { status: 'published' };
  if (params.communityId) where.communityId = params.communityId;
  if (params.authorId) where.authorId = params.authorId;

  let posts = await (prisma as any).publicationPost.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  const usersMap = await getUsersMap(posts.map((p: any) => p.authorId));
  const communityIds = Array.from(new Set(posts.map((p: any) => p.communityId).filter(Boolean)));
  const communities = communityIds.length
    ? await (prisma as any).community.findMany({ where: { id: { in: communityIds } }, select: { id: true, name: true, slug: true, avatarUrl: true } })
    : [];
    const communityMap = new Map((communities || []).map((c: any) => [c.id, c]));

  const postIds = posts.map((p: any) => p.id);
  const comments = postIds.length
    ? await (prisma as any).publicationComment.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } })
    : [];
  const reactions = postIds.length
    ? await (prisma as any).publicationReaction.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } })
    : [];
  const commentsCountMap = new Map((comments || []).map((x: any) => [x.postId, x._count._all]));
  const reactionsCountMap = new Map((reactions || []).map((x: any) => [x.postId, x._count._all]));
  const myReactions = params.viewerUserId && postIds.length
    ? await (prisma as any).publicationReaction.findMany({
        where: { postId: { in: postIds }, userId: params.viewerUserId, type: 'like' },
        select: { postId: true }
      })
    : [];
  const myReactionsSet = new Set((myReactions || []).map((r: any) => r.postId));

  return posts.map((p: any) => ({
    ...p,
    author: usersMap.get(p.authorId) || null,
    community: p.communityId ? communityMap.get(p.communityId) || null : null,
    commentsCount: commentsCountMap.get(p.id) || 0,
    reactionsCount: reactionsCountMap.get(p.id) || 0,
    likedByMe: myReactionsSet.has(p.id)
  }));
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

async function getPublicPostDetails(postId: string, viewerUserId?: string) {
  await ensurePublicationCommentReactionsTable();
  const post = await (prisma as any).publicationPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== 'published') return null;
  const usersMap = await getUsersMap([post.authorId]);
  const comments = await (prisma as any).publicationComment.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
  const commentsUsersMap = await getUsersMap(comments.map((c: any) => c.authorId));
  const reactionsCount = await (prisma as any).publicationReaction.count({ where: { postId } });
  const community = post.communityId
    ? await (prisma as any).community.findUnique({
        where: { id: post.communityId },
        select: { id: true, slug: true, name: true, avatarUrl: true, coverUrl: true }
      })
    : null;
  const commentIds = comments.map((c: any) => c.id);
  const commentReactionsCountMap = await getCommentReactionsCountMap(commentIds);
  const myCommentReactionSet = await getMyCommentReactionSet(commentIds, viewerUserId);

  return {
    ...post,
    author: usersMap.get(post.authorId) || null,
    comments: comments.map((c: any) => ({
      ...c,
      author: commentsUsersMap.get(c.authorId) || null,
      reactionsCount: commentReactionsCountMap.get(c.id) || 0,
      likedByMe: myCommentReactionSet.has(c.id)
    })),
    community,
    reactionsCount,
    likedByMe: false
  };
}

router.get('/public/publications/discovery', async (_req, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    const items = await buildFeed({});
    const communities = await (prisma as any).community.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, name: true, description: true, avatarUrl: true }
    });
    const authorsMap = new Map<string, any>();
    for (const post of items) {
      const author = post.author;
      if (!author) continue;
      if (!['psychologist', 'researcher'].includes(author.role)) continue;
      if (!authorsMap.has(author.id)) authorsMap.set(author.id, author);
    }
    res.json({
      items,
      communities,
      authors: Array.from(authorsMap.values())
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

router.get('/communities', requireAuth, async (_req, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    const rows = await (prisma as any).community.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: rows || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load communities' });
  }
});

router.post('/communities', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const avatarUrl = req.body?.avatarUrl ? String(req.body.avatarUrl) : null;
    const coverUrl = req.body?.coverUrl ? String(req.body.coverUrl) : null;
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
    res.status(500).json({ error: e.message || 'Failed to create community' });
  }
});

router.get('/communities/:slug', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const slug = String(req.params.slug || '');
    const community = await (prisma as any).community.findFirst({ where: { slug } });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    const postsCount = await (prisma as any).publicationPost.count({ where: { communityId: community.id, status: 'published' } });
    const membersCount = await (prisma as any).communityMember.count({ where: { communityId: community.id } });
    const members = await getCommunityMembers(community.id);
    const currentMembership = members.find((m: any) => m.userId === req.user!.id) || null;
    const posts = await (prisma as any).publicationPost.findMany({
      where: { communityId: community.id, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const usersMap = await getUsersMap(posts.map((p: any) => p.authorId));
    res.json({
      community: {
        ...community,
        postsCount,
        membersCount,
        isSubscribed: !!currentMembership,
        currentRole: currentMembership?.role || null
      },
      members,
      posts: posts.map((p: any) => ({
        ...p,
        author: usersMap.get(p.authorId) || null
      }))
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
    const member = await (prisma as any).communityMember.findFirst({
      where: { communityId: id, userId: req.user!.id }
    });
    if (!member || !['owner', 'moderator'].includes(member.role)) {
      return res.status(403).json({ error: 'Недостаточно прав на управление сообществом' });
    }
    const patch: any = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim();
    if (req.body?.avatarUrl !== undefined) patch.avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl) : null;
    if (req.body?.coverUrl !== undefined) patch.coverUrl = req.body.coverUrl ? String(req.body.coverUrl) : null;
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
    res.status(500).json({ error: e.message || 'Failed to update community' });
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
    const items = await buildFeed({ communityId, authorId, viewerUserId: (req as AuthedRequest).user?.id });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feed' });
  }
});

router.get('/publications/discovery', requireAuth, async (_req, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
    const items = await buildFeed({ viewerUserId: (_req as AuthedRequest).user?.id });
    const communities = await (prisma as any).community.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, slug: true, name: true, description: true, avatarUrl: true }
    });
    const authorsMap = new Map<string, any>();
    for (const post of items) {
      const author = post.author;
      if (!author) continue;
      if (!['psychologist', 'researcher'].includes(author.role)) continue;
      if (!authorsMap.has(author.id)) authorsMap.set(author.id, author);
    }
    res.json({
      items,
      communities,
      authors: Array.from(authorsMap.values())
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load discovery' });
  }
});

router.get('/publications/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await cleanupLegacySeedCommunitiesOnce();
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
    const comments = postIds.length
      ? await (prisma as any).publicationComment.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } })
      : [];
    const commentsMap = new Map((comments || []).map((x: any) => [x.postId, x._count._all]));
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
    res.json({
      posts,
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
    const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim() : null;
    const communityId = req.body?.communityId ? String(req.body.communityId) : null;
    const authorMode = req.body?.authorMode === 'community' ? 'community' : 'account';
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    if (!title || !content) return res.status(400).json({ error: 'Заполните заголовок и текст' });
    if (communityId) {
      const c = await (prisma as any).community.findUnique({ where: { id: communityId } });
      if (!c) return res.status(404).json({ error: 'Сообщество не найдено' });
      if (authorMode === 'community') {
        const membership = await (prisma as any).communityMember.findFirst({
          where: { communityId, userId: req.user!.id }
        });
        if (!membership && req.user!.role !== 'admin') {
          return res.status(403).json({ error: 'Нельзя публиковать от лица этого сообщества' });
        }
      }
    } else if (authorMode === 'community') {
      return res.status(400).json({ error: 'Для публикации от лица сообщества выберите сообщество' });
    }
    let post: any;
    try {
      post = await (prisma as any).publicationPost.create({
        data: { title, content, imageUrl, communityId, authorId: req.user!.id, authorMode, status }
      });
    } catch (createError: any) {
      // Fallback для несинхронизированного Prisma client без imageUrl
      const createMessage = String(createError?.message || '');
      if (createMessage.includes('Unknown argument `imageUrl`') || createMessage.includes('Unknown argument `authorMode`')) {
        post = await (prisma as any).publicationPost.create({
          data: { title, content, communityId, authorId: req.user!.id, status }
        });
      } else {
        throw createError;
      }
    }
    const usersMap = await getUsersMap([post.authorId]);
    res.status(201).json({ item: { ...post, author: usersMap.get(post.authorId) || null } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create post' });
  }
});

router.patch('/publications/posts/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== req.user!.id && req.user!.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    const patch: any = {};
    if (req.body?.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body?.content !== undefined) patch.content = String(req.body.content).trim();
    if (req.body?.imageUrl !== undefined) patch.imageUrl = req.body.imageUrl ? String(req.body.imageUrl) : null;
    if (req.body?.authorMode !== undefined) patch.authorMode = req.body.authorMode === 'community' ? 'community' : 'account';
    if (req.body?.status !== undefined) patch.status = req.body.status === 'published' ? 'published' : 'draft';
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
    res.status(500).json({ error: e.message || 'Failed to update post' });
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
    if (post.authorId !== req.user!.id && req.user!.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
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
    const item = await getPublicPostDetails(id, req.user!.id);
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

router.post('/publications/posts/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!canCreate(req.user!.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    const id = String(req.params.id || '');
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Комментарий пустой' });
    const post = await (prisma as any).publicationPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = await (prisma as any).publicationComment.create({
      data: { postId: id, authorId: req.user!.id, content }
    });
    const usersMap = await getUsersMap([comment.authorId]);
    res.status(201).json({ item: { ...comment, author: usersMap.get(comment.authorId) || null } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create comment' });
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

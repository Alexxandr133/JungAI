export const DEFAULT_FLAIRS = ['Пост', 'Обсуждение', 'Вопрос', 'Кейс', 'Методика', 'Новость', 'Ресурс'] as const;

/** Legacy posts without flair → «Пост». */
export function resolvePostType(flair?: string | null): string {
  const value = String(flair || '').trim();
  return value || 'Пост';
}

/** Layout: replies under post. Other types use side comments panel. */
export function isDiscussionType(flair?: string | null) {
  return resolvePostType(flair) === 'Обсуждение';
}

export type ForumAuthor = {
  id: string;
  email?: string | null;
  role?: string;
  name?: string | null;
  avatarUrl?: string | null;
};

export type ForumCommunity = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  ownerId?: string;
  membersCount?: number;
  postsCount?: number;
  isSubscribed?: boolean;
  currentRole?: string | null;
  createdAt?: string;
};

export type ForumPost = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  flair?: string | null;
  isPinned?: boolean;
  authorId?: string;
  communityId?: string | null;
  authorMode?: 'account' | 'community' | string;
  createdAt: string;
  commentsCount: number;
  reactionsCount?: number;
  likedByMe?: boolean;
  canPin?: boolean;
  canDelete?: boolean;
  status?: string;
  author?: ForumAuthor | null;
  community?: ForumCommunity | null;
};

export function excerptFromHtml(html: string, max = 220): string {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function formatForumTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export function authorLabel(post: Pick<ForumPost, 'authorMode' | 'author' | 'community'>): string {
  if (post.authorMode === 'community' && post.community?.name) return post.community.name;
  return post.author?.name || post.author?.email || 'Автор';
}

export function canCreateForum(role?: string) {
  return role === 'psychologist' || role === 'researcher' || role === 'admin' || role === 'client';
}

export function canSpeakAsCommunity(role?: string | null, membershipRole?: string | null) {
  return role === 'admin' || membershipRole === 'owner' || membershipRole === 'moderator';
}

export function canManageCommunity(role?: string | null, membershipRole?: string | null) {
  return canSpeakAsCommunity(role, membershipRole);
}

export type ForumComment = {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  authorId?: string;
  reactionsCount?: number;
  likedByMe?: boolean;
  author?: ForumAuthor | null;
};

export type NestedForumComment = ForumComment & { replies: NestedForumComment[] };

/** Build a nested reply tree (any depth present in the flat list). */
export function nestComments(comments: ForumComment[]): NestedForumComment[] {
  const byId = new Map<string, NestedForumComment>();
  for (const item of comments) {
    byId.set(item.id, { ...item, replies: [] });
  }
  const roots: NestedForumComment[] = [];
  for (const item of comments) {
    const node = byId.get(item.id)!;
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function countNestedReplies(node: NestedForumComment): number {
  return node.replies.reduce((sum, child) => sum + 1 + countNestedReplies(child), 0);
}

export function repliesLabel(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} ответов`;
  if (n1 === 1) return `${count} ответ`;
  if (n1 >= 2 && n1 <= 4) return `${count} ответа`;
  return `${count} ответов`;
}

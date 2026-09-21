import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { GuestNavbar } from '../../components/GuestNavbar';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';
import { PostKebab } from './ThreadCard';
import {
  authorLabel,
  canCreateForum,
  countNestedReplies,
  formatForumTime,
  isDiscussionType,
  nestComments,
  repliesLabel,
  resolvePostType,
  type ForumComment,
  type NestedForumComment
} from './forumUtils';
import { usePageMeta } from '../../hooks/usePageMeta';
import './communities.css';

const PAGE = 15;

type PostDetails = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  flair?: string | null;
  isPinned?: boolean;
  createdAt: string;
  authorMode?: string;
  canPin?: boolean;
  canDelete?: boolean;
  canModerate?: boolean;
  author?: { id: string; name?: string | null; email?: string | null; role?: string; avatarUrl?: string | null } | null;
  community?: { id: string; slug: string; name: string } | null;
  comments: ForumComment[];
  commentsCount?: number;
  commentsTotalRoots?: number;
  commentsHasMore?: boolean;
  reactionsCount: number;
  likedByMe: boolean;
};

export default function PostView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [post, setPost] = useState<PostDetails | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [rootsLoaded, setRootsLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLElement | null>(null);
  const paneScrollRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [commentsWidth, setCommentsWidth] = useState(() => {
    try {
      const raw = localStorage.getItem('forum_comments_width');
      const n = raw ? Number(raw) : 420;
      return Number.isFinite(n) ? Math.min(720, Math.max(280, n)) : 420;
    } catch {
      return 420;
    }
  });
  const commentsWidthRef = useRef(commentsWidth);
  const [resizing, setResizing] = useState(false);
  const canWrite = useMemo(() => canCreateForum(user?.role), [user?.role]);
  commentsWidthRef.current = commentsWidth;
  const nested = useMemo(() => nestComments(comments), [comments]);
  const isDiscussion = isDiscussionType(post?.flair);

  async function loadPost() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const path = token ? `/api/publications/posts/${id}` : `/api/public/publications/posts/${id}`;
      const res = await api<{ item: PostDetails }>(path, token ? { token } : undefined);
      setPost(res.item);
      setComments(res.item.comments || []);
      const roots = (res.item.comments || []).filter((c) => !c.parentId).length;
      setRootsLoaded(roots);
      setHasMore(Boolean(res.item.commentsHasMore));
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить пост');
    } finally {
      setLoading(false);
    }
  }

  const loadMoreComments = useCallback(async () => {
    if (!id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const path = token
        ? `/api/publications/posts/${id}/comments?offset=${rootsLoaded}&limit=${PAGE}`
        : `/api/public/publications/posts/${id}/comments?offset=${rootsLoaded}&limit=${PAGE}`;
      const res = await api<{
        comments: ForumComment[];
        hasMore: boolean;
      }>(path, token ? { token } : undefined);
      const incoming = res.comments || [];
      const newRoots = incoming.filter((c) => !c.parentId).length;
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
      });
      setRootsLoaded((n) => n + newRoots);
      setHasMore(Boolean(res.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }, [id, token, loadingMore, hasMore, rootsLoaded]);

  useEffect(() => {
    setExpandedReplies({});
  }, [id]);

  function toggleReplies(commentId: string) {
    setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  }

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: MouseEvent) {
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const next = Math.min(720, Math.max(280, rect.right - e.clientX));
      commentsWidthRef.current = next;
      setCommentsWidth(next);
    }
    function onUp() {
      setResizing(false);
      try {
        localStorage.setItem('forum_comments_width', String(commentsWidthRef.current));
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  useEffect(() => {
    loadPost().catch(() => undefined);
  }, [token, id]);

  usePageMeta({
    title: post?.title || 'Публикация',
    description: post?.content
      ? String(post.content)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 200)
      : 'Публикация в сообществе JungAI',
    path: id ? `/publications/post/${id}` : undefined,
    image: post?.imageUrl,
    type: 'article',
  });

  useEffect(() => {
    if (!isDiscussion) return;
    function onScroll() {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= window.innerHeight + 160) void loadMoreComments();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMoreComments, post?.id, isDiscussion]);

  useEffect(() => {
    if (isDiscussion) return;
    const el = paneScrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      if (nearBottom) void loadMoreComments();
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadMoreComments, post?.id, isDiscussion]);

  async function submitComment(text: string, parentId?: string | null) {
    if (!token || !id || !text.trim() || !canWrite) return;
    setSaving(true);
    try {
      await api(`/api/publications/posts/${id}/comments`, {
        method: 'POST',
        token,
        body: { content: text.trim(), parentId: parentId || undefined }
      });
      if (parentId) {
        setReplyText('');
        setReplyTo(null);
        setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
      } else {
        setComment('');
      }
      const path = `/api/publications/posts/${id}/comments?offset=0&limit=${PAGE}`;
      const res = await api<{
        comments: ForumComment[];
        hasMore: boolean;
        totalRoots: number;
      }>(path, { token });
      setComments(res.comments || []);
      setRootsLoaded((res.comments || []).filter((c) => !c.parentId).length);
      setHasMore(Boolean(res.hasMore));
      setPost((p) =>
        p
          ? {
              ...p,
              commentsCount: (p.commentsCount || 0) + 1,
              commentsTotalRoots: res.totalRoots ?? p.commentsTotalRoots
            }
          : p
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleReaction() {
    if (!token || !id) return;
    await api(`/api/publications/posts/${id}/reactions`, { method: 'POST', token, body: { type: 'like' } });
    const res = await api<{ item: PostDetails }>(`/api/publications/posts/${id}`, { token });
    setPost((p) =>
      p
        ? {
            ...p,
            likedByMe: res.item.likedByMe,
            reactionsCount: res.item.reactionsCount,
            canPin: res.item.canPin,
            canDelete: res.item.canDelete,
            isPinned: res.item.isPinned
          }
        : p
    );
  }

  async function toggleCommentLike(commentId: string) {
    if (!token) return;
    const res = await api<{ active: boolean; reactionsCount: number }>(
      `/api/publications/comments/${commentId}/reactions`,
      { method: 'POST', token, body: { type: 'like' } }
    );
    setComments((list) =>
      list.map((c) =>
        c.id === commentId ? { ...c, likedByMe: res.active, reactionsCount: res.reactionsCount } : c
      )
    );
  }

  async function togglePin() {
    if (!token || !id || !post?.canPin) return;
    await api(`/api/publications/posts/${id}`, {
      method: 'PATCH',
      token,
      body: { isPinned: !post.isPinned }
    });
    setPost((p) => (p ? { ...p, isPinned: !p.isPinned } : p));
  }

  async function deletePost() {
    if (!token || !id || !post?.canDelete) return;
    if (!window.confirm('Удалить этот пост и все ответы?')) return;
    await api(`/api/publications/posts/${id}`, { method: 'DELETE', token });
    navigate(post.community?.slug ? `/publications/community/${post.community.slug}` : '/communities');
  }

  async function deleteReply(commentId: string) {
    if (!token) return;
    if (!window.confirm('Удалить ответ и вложенные ответы?')) return;
    await api(`/api/publications/comments/${commentId}`, { method: 'DELETE', token });
    const removeIds = new Set<string>();
    const byParent = new Map<string, string[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = byParent.get(c.parentId) || [];
      list.push(c.id);
      byParent.set(c.parentId, list);
    }
    function collect(cid: string) {
      removeIds.add(cid);
      for (const child of byParent.get(cid) || []) collect(child);
    }
    collect(commentId);
    setComments((list) => list.filter((c) => !removeIds.has(c.id)));
    setPost((p) => (p ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - removeIds.size) } : p));
  }

  function canDeleteReply(item: ForumComment) {
    if (!user) return false;
    if (post?.canModerate || user.role === 'admin') return true;
    return item.author?.id === user.id || item.authorId === user.id;
  }

  function renderBranch(item: NestedForumComment, depth = 0): ReactNode {
    const repliesOpen = Boolean(expandedReplies[item.id]);
    const nestedCount = countNestedReplies(item);
    return (
      <div key={item.id} className={`forum__comment-thread${depth > 0 ? ' is-nested' : ''}`}>
        <div className="forum__comment forum__comment--row">
          <span className="forum__nav-avatar forum__nav-avatar--lg">
            {resolvePublicFileUrl(item.author?.avatarUrl) ? (
              <img src={resolvePublicFileUrl(item.author?.avatarUrl) || ''} alt="" />
            ) : (
              (item.author?.name || item.author?.email || 'U').slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="forum__comment-body">
            <div className="forum__comment-meta">
              <span className="forum__comment-author">{item.author?.name || item.author?.email || 'Пользователь'}</span>
              <span>{formatForumTime(item.createdAt)}</span>
            </div>
            <div className="forum__comment-text">{item.content}</div>
            <div className="forum__comment-actions">
              {token && (
                <button type="button" className="forum__stat" onClick={() => void toggleCommentLike(item.id)}>
                  <PlatformIcon name="thumbsUp" size={13} /> {item.reactionsCount || 0}
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  className="forum__reply-btn"
                  onClick={() => {
                    setReplyTo(item.id);
                    setReplyText('');
                    setExpandedReplies((prev) => ({ ...prev, [item.id]: true }));
                  }}
                >
                  Ответить
                </button>
              )}
              {canDeleteReply(item) && (
                <button type="button" className="forum__reply-btn forum__reply-btn--danger" onClick={() => void deleteReply(item.id)}>
                  Удалить
                </button>
              )}
            </div>
            {replyTo === item.id && (
              <div className="forum__composer forum__composer--inline">
                <textarea
                  className="forum__textarea"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Написать ответ…"
                />
                <div className="forum__actions">
                  <button className="forum__text-btn" type="button" onClick={() => setReplyTo(null)}>
                    Отмена
                  </button>
                  <button
                    className="forum__new-post"
                    type="button"
                    disabled={saving || !replyText.trim()}
                    onClick={() => void submitComment(replyText, item.id)}
                  >
                    {saving ? 'Отправка…' : 'Отправить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {item.replies.length > 0 && (
          <>
            <button
              type="button"
              className="forum__replies-toggle"
              style={{ marginLeft: Math.min(12 + depth * 12, 48) }}
              onClick={() => toggleReplies(item.id)}
              aria-expanded={repliesOpen}
            >
              {repliesOpen ? 'Скрыть ветку' : `Показать ветку (${nestedCount})`}
            </button>
            {repliesOpen && (
              <div className="forum__comment-replies">{item.replies.map((child) => renderBranch(child, depth + 1))}</div>
            )}
          </>
        )}
      </div>
    );
  }

  const banner = post ? resolvePublicFileUrl(post.imageUrl) || post.imageUrl : '';
  const repliesCount = post?.commentsCount ?? comments.length;
  const threadLabel = isDiscussion ? 'Ответы' : 'Комментарии';
  const threadEmpty = isDiscussion
    ? 'Пока нет ответов. Начните обсуждение.'
    : 'Пока нет комментариев.';
  const threadMore = isDiscussion ? 'Ещё ответы' : 'Ещё комментарии';
  const threadPlaceholder = isDiscussion ? 'Написать ответ…' : 'Написать комментарий…';
  const threadLogin = isDiscussion ? (
    <>
      Чтобы отвечать, <Link to="/login">войдите</Link>.
    </>
  ) : (
    <>
      Чтобы комментировать, <Link to="/login">войдите</Link>.
    </>
  );
  const engageMeta = isDiscussion ? repliesLabel(repliesCount) : `${repliesCount} коммент.`;

  const postMeta = post && (
    <>
      <div className="forum__row-topline">
        {post.community?.slug && (
          <Link to={`/publications/community/${post.community.slug}`} className="forum__row-community">
            {post.community.name}
          </Link>
        )}
        {resolvePostType(post.flair) ? (
          <span className="forum__row-type">{resolvePostType(post.flair)}</span>
        ) : null}
        {post.isPinned && <span className="forum__row-pin">Закреплено</span>}
        <PostKebab
          canPin={Boolean(post.canPin && post.community)}
          isPinned={post.isPinned}
          onPin={post.canPin ? () => void togglePin() : undefined}
          canDelete={post.canDelete}
          onDelete={post.canDelete ? () => void deletePost() : undefined}
        />
      </div>
      <h1 className="forum__post-title">{post.title}</h1>
      <div className="forum__meta-left forum__post-byline">
        <span className="forum__avatar">
          {resolvePublicFileUrl(post.author?.avatarUrl) ? (
            <img src={resolvePublicFileUrl(post.author?.avatarUrl) || ''} alt="" />
          ) : (
            authorLabel(post).slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="forum__post-byline-text">
          <span className="forum__post-author">{authorLabel(post)}</span>
          <span className="forum__post-time">{formatForumTime(post.createdAt)}</span>
        </div>
      </div>
    </>
  );

  const postEngage = post && (
    <div className="forum__post-engage">
      {token ? (
        <button
          type="button"
          className={`forum__like-outline${post.likedByMe ? ' is-liked' : ''}`}
          onClick={() => void toggleReaction()}
        >
          <PlatformIcon name="thumbsUp" size={14} />
          {post.reactionsCount || 0}
        </button>
      ) : (
        <span className="forum__muted">{post.reactionsCount || 0} оценок</span>
      )}
      <span className="forum__post-engage-meta">{engageMeta}</span>
    </div>
  );

  const composer = canWrite ? (
    <div className={isDiscussion ? 'forum__discussion-composer' : 'forum__comments-composer'}>
      <textarea
        className="forum__textarea"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submitComment(comment);
          }
        }}
        placeholder={threadPlaceholder}
        rows={isDiscussion ? 3 : 2}
      />
      <button
        className="forum__new-post forum__comments-send"
        type="button"
        onClick={() => void submitComment(comment)}
        disabled={saving || !comment.trim()}
      >
        {saving ? '…' : 'Отправить'}
      </button>
    </div>
  ) : (
    !token && <div className={`forum__comments-login${isDiscussion ? ' forum__comments-login--inline' : ''}`}>{threadLogin}</div>
  );

  const threadList = (
    <>
      {nested.map((item) => renderBranch(item))}
      {nested.length === 0 && <div className="forum__muted forum__comments-empty">{threadEmpty}</div>}
      {loadingMore && <div className="forum__muted forum__comments-loading">Загрузка…</div>}
      {!loadingMore && hasMore && (
        <button type="button" className="forum__text-btn forum__comments-more" onClick={() => void loadMoreComments()}>
          {threadMore}
        </button>
      )}
    </>
  );

  return (
    <div className={`forum${isDiscussion ? '' : ' forum--post-page'}`}>
      {user ? <UniversalNavbar /> : <GuestNavbar />}
      <main className={`forum__main${isDiscussion ? ' forum__main--hub' : ' forum__main--post'}`}>
        <div className={`forum__page${isDiscussion ? ' forum__page--discussion' : ' forum__page--bleed forum__page--post'}`}>
          {loading && <div className="forum__muted">Загрузка...</div>}
          {error && <div className="forum__error">{error}</div>}
          {post && isDiscussion && (
            <>
              <nav className="forum__crumb">
                <Link to="/communities">Сообщества</Link>
                <span>→</span>
                {post.community?.slug ? (
                  <Link to={`/publications/community/${post.community.slug}`}>{post.community.name}</Link>
                ) : (
                  <span>Обсуждение</span>
                )}
              </nav>

              <article className="forum__discussion">
                {banner && (
                  <div className="forum__discussion-banner">
                    <img src={banner} alt="" />
                  </div>
                )}
                <div className="forum__discussion-head">{postMeta}</div>
                <div className="forum__body forum__body--article" dangerouslySetInnerHTML={{ __html: post.content }} />
                {postEngage}
              </article>

              <section className="forum__discussion-replies" ref={scrollRef}>
                <div className="forum__comments-head forum__comments-head--inline">
                  <h2 className="forum__comments-title">{threadLabel}</h2>
                  <span className="forum__comments-count">{repliesCount}</span>
                </div>
                {composer}
                <div className="forum__discussion-list">{threadList}</div>
              </section>
            </>
          )}

          {post && !isDiscussion && (
            <>
              <nav className="forum__crumb forum__crumb--post">
                <Link to="/communities">Сообщества</Link>
                <span>→</span>
                {post.community?.slug ? (
                  <Link to={`/publications/community/${post.community.slug}`}>{post.community.name}</Link>
                ) : (
                  <span>Пост</span>
                )}
              </nav>

              <div
                ref={shellRef}
                className={`forum__post-shell${resizing ? ' is-resizing' : ''}`}
                style={{ ['--forum-comments-width' as string]: `${commentsWidth}px` }}
              >
                <section className="forum__post-pane">
                  {banner && (
                    <div className="forum__post-banner">
                      <img src={banner} alt="" />
                    </div>
                  )}
                  <div className="forum__post-card">
                    {postMeta}
                    <div className="forum__body forum__body--article" dangerouslySetInnerHTML={{ __html: post.content }} />
                    {postEngage}
                  </div>
                </section>

                <aside className="forum__comments-pane">
                  <div
                    className="forum__comments-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Изменить ширину комментариев"
                    tabIndex={0}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setResizing(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') setCommentsWidth((w) => Math.min(720, w + 24));
                      if (e.key === 'ArrowRight') setCommentsWidth((w) => Math.max(280, w - 24));
                    }}
                  >
                    <div className="forum__comments-resizer-grip" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="forum__comments-head">
                    <h2 className="forum__comments-title">{threadLabel}</h2>
                    <span className="forum__comments-count">{repliesCount}</span>
                  </div>
                  <div className="forum__comments-scroll" ref={paneScrollRef}>
                    {threadList}
                  </div>
                  {composer}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

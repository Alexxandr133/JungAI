import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_FEED_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import { ThreadCard } from './ThreadCard';
import { canCreateForum, type ForumCommunity, type ForumPost } from './forumUtils';
import './communities.css';

type SortKey = 'new' | 'active' | 'top';
type ScopeKey = 'subs' | 'all';

export default function FeedPage() {
  const { token, user } = useAuth();
  const narrow = useIsNarrowViewport();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [mine, setMine] = useState<ForumCommunity[]>([]);
  const [recommended, setRecommended] = useState<ForumCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>('new');
  const [scope, setScope] = useState<ScopeKey>('all');

  async function loadRails() {
    if (!token) return;
    const res = await api<{ mine?: ForumCommunity[]; recommended?: ForumCommunity[]; communities?: ForumCommunity[] }>(
      '/api/publications/discovery',
      { token }
    );
    setMine(res.mine || []);
    setRecommended(res.recommended || (res.communities || []).filter((c) => !c.isSubscribed).slice(0, 8));
  }

  async function loadFeed() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ items: ForumPost[] }>(
        `/api/publications/feed?sort=${sort}&scope=${scope}`,
        { token }
      );
      setPosts(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRails().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    loadFeed().catch(() => undefined);
  }, [token, sort, scope]);

  async function toggleLike(post: ForumPost) {
    if (!token) return;
    const prev = posts;
    setPosts((list) =>
      list.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              reactionsCount: Math.max(0, (p.reactionsCount || 0) + (p.likedByMe ? -1 : 1))
            }
          : p
      )
    );
    try {
      const res = await api<{ active: boolean; reactionsCount: number }>(
        `/api/publications/posts/${post.id}/reactions`,
        { method: 'POST', token, body: { type: 'like' } }
      );
      setPosts((list) =>
        list.map((p) =>
          p.id === post.id ? { ...p, likedByMe: res.active, reactionsCount: res.reactionsCount } : p
        )
      );
    } catch {
      setPosts(prev);
    }
  }

  async function toggleSub(community: ForumCommunity) {
    if (!token) return;
    await api(`/api/communities/${community.id}/subscription`, { method: 'POST', token });
    await loadRails();
    if (scope === 'subs') await loadFeed();
  }

  usePsychologistPlatformTour({
    tourId: 'feed',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && !loading && (user?.role === 'psychologist' || user?.role === 'admin')),
    steps: PSYCHOLOGIST_FEED_TOUR_STEPS
  });

  function railList(title: string, items: ForumCommunity[], empty: string) {
    return (
      <div>
        <h3>{title}</h3>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {items.map((community) => (
            <div key={community.id} className="forum__rail-item">
              <Link to={`/publications/community/${community.slug}`} className="forum__rail-item" style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
                <span className="forum__avatar-lg" style={{ width: 36, height: 36 }}>
                  {resolvePublicFileUrl(community.avatarUrl) ? (
                    <img src={resolvePublicFileUrl(community.avatarUrl) || ''} alt="" />
                  ) : (
                    community.name.slice(0, 1)
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {community.name}
                  </div>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    {community.membersCount || 0} участников
                  </div>
                </span>
              </Link>
              <button
                type="button"
                className={community.isSubscribed ? 'button secondary' : 'button'}
                style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => void toggleSub(community)}
              >
                {community.isSubscribed ? 'Вы подписаны' : 'Подписаться'}
              </button>
            </div>
          ))}
          {items.length === 0 && <div className="small" style={{ color: 'var(--text-muted)' }}>{empty}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="forum">
      <UniversalNavbar />
      <main className="forum__main">
        <div data-tour="feed-header" className="card" style={{ padding: narrow ? 14 : 16, marginBottom: 14, maxWidth: 1120, marginInline: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h1 className="forum__h1" style={{ fontSize: 24 }}>Лента</h1>
              <div className="forum__lead">Превью постов: заголовок, excerpt и мета</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PsychologistTourHelpButton
                tourId="feed"
                steps={PSYCHOLOGIST_FEED_TOUR_STEPS}
                userId={user?.id}
                role={user?.role}
              />
              {canCreateForum(user?.role) && (
                <Link to="/publications/new" className="button">
                  Новый пост
                </Link>
              )}
            </div>
          </div>
          <div className="forum__chips" style={{ marginTop: 14 }}>
            {(['subs', 'all'] as ScopeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`forum__chip${scope === key ? ' is-active' : ''}`}
                onClick={() => setScope(key)}
              >
                {key === 'subs' ? 'Подписки' : 'Все'}
              </button>
            ))}
          </div>
          <div className="forum__chips" style={{ marginTop: 8 }}>
            {([
              ['new', 'Новые'],
              ['active', 'Активные'],
              ['top', 'Топ']
            ] as Array<[SortKey, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`forum__chip${sort === key ? ' is-active' : ''}`}
                onClick={() => setSort(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="forum__layout">
          <section data-tour="feed-posts" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            {loading && <div className="small">Загрузка...</div>}
            {posts.map((post) => (
              <ThreadCard key={post.id} post={post} onLike={toggleLike} />
            ))}
            {!loading && posts.length === 0 && (
              <div className="card" style={{ padding: 24, color: 'var(--text-muted)' }}>
                {scope === 'subs' ? 'В подписках пока нет постов. Переключитесь на «Все» или подпишитесь на сообщества.' : 'Лента пока пустая.'}
              </div>
            )}
          </section>
          <aside data-tour="feed-communities" className="card forum__rail">
            {railList('Мои сообщества', mine, 'Пока нет подписок')}
            {railList('Рекомендуемые', recommended, 'Нет рекомендаций')}
            <Link to="/communities" className="small" style={{ color: 'var(--primary)' }}>
              Каталог сообществ
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}

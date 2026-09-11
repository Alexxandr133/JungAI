import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';
import { ThreadCard } from './ThreadCard';
import { canCreateForum, canSpeakAsCommunity, formatForumTime, type ForumCommunity, type ForumPost } from './forumUtils';
import './communities.css';

type SortKey = 'new' | 'active' | 'top';

export default function CommunityView() {
  const { slug = '' } = useParams();
  const { token, user } = useAuth();
  const [community, setCommunity] = useState<ForumCommunity | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [flairs, setFlairs] = useState<string[]>([]);
  const [moderators, setModerators] = useState<Array<{ role: string; user?: { name?: string | null; email?: string | null } | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const [flair, setFlair] = useState('');

  const canManage = Boolean(
    community && (canSpeakAsCommunity(user?.role, community.currentRole) || user?.role === 'admin')
  );

  async function load() {
    if (!token || !slug) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ sort });
      if (flair) q.set('flair', flair);
      const res = await api<{
        community: ForumCommunity;
        posts: ForumPost[];
        flairs?: string[];
        moderators?: Array<{ role: string; user?: { name?: string | null; email?: string | null } | null }>;
      }>(`/api/communities/${slug}?${q.toString()}`, { token });
      setCommunity(res.community);
      setPosts(
        (res.posts || []).map((p) => ({
          ...p,
          canPin: Boolean(
            p.canPin || canSpeakAsCommunity(user?.role, res.community?.currentRole) || p.authorId === user?.id
          )
        }))
      );
      setFlairs(res.flairs || []);
      setModerators(res.moderators || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить сообщество');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token, slug, sort, flair]);

  async function toggleSubscription() {
    if (!token || !community) return;
    await api(`/api/communities/${community.id}/subscription`, { method: 'POST', token });
    await load();
  }

  async function toggleLike(post: ForumPost) {
    if (!token) return;
    const res = await api<{ active: boolean; reactionsCount: number }>(
      `/api/publications/posts/${post.id}/reactions`,
      { method: 'POST', token, body: { type: 'like' } }
    );
    setPosts((list) =>
      list.map((p) => (p.id === post.id ? { ...p, likedByMe: res.active, reactionsCount: res.reactionsCount } : p))
    );
  }

  async function togglePin(post: ForumPost) {
    if (!token) return;
    await api(`/api/publications/posts/${post.id}`, {
      method: 'PATCH',
      token,
      body: { isPinned: !post.isPinned }
    });
    await load();
  }

  async function deletePost(post: ForumPost) {
    if (!token || !post.canDelete) return;
    if (!window.confirm('Удалить пост и все ответы?')) return;
    await api(`/api/publications/posts/${post.id}`, { method: 'DELETE', token });
    setPosts((list) => list.filter((p) => p.id !== post.id));
  }

  const cover = resolvePublicFileUrl(community?.coverUrl);
  const avatar = resolvePublicFileUrl(community?.avatarUrl);

  return (
    <div className="forum">
      <UniversalNavbar />
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          {error && <div className="forum__error">{error}</div>}

          <div className={`forum__cover-bleed${cover ? '' : ' is-empty'}`}>
            {cover ? <img src={cover} alt="" /> : null}
          </div>

          <header className="forum__community-head">
            <div className="forum__community-identity">
              <span className="forum__nav-avatar forum__nav-avatar--xl">
                {avatar ? <img src={avatar} alt="" /> : (community?.name || 'C').slice(0, 1)}
              </span>
              <div className="forum__hub-title-block">
                <nav className="forum__crumb forum__crumb--inline">
                  <Link to="/communities">Сообщества</Link>
                  <span>→</span>
                  <span>{community?.name || '…'}</span>
                </nav>
                <h1 className="forum__h1 forum__h1--hub">{community?.name || 'Сообщество'}</h1>
                {community?.description ? (
                  <p className="forum__lead forum__lead--hub">{community.description}</p>
                ) : null}
                <p className="forum__muted">
                  {community?.membersCount || 0} участников · {community?.postsCount || 0} постов
                </p>
              </div>
            </div>
            <div className="forum__community-actions">
              <button
                type="button"
                className="forum__text-btn forum__text-btn--strong"
                onClick={() => void toggleSubscription()}
              >
                {community?.isSubscribed ? 'Отписка' : 'Подписка'}
              </button>
              {canManage && community && (
                <Link className="forum__text-btn forum__text-btn--strong" to={`/publications/community/${community.id}/manage`}>
                  Управление
                </Link>
              )}
              {canCreateForum(user?.role) && (
                <Link to={`/publications/new?community=${community?.id || ''}`} className="forum__new-post">
                  <PlatformIcon name="plus" size={14} strokeWidth={2} />
                  Новый пост
                </Link>
              )}
            </div>
          </header>

          <div className="forum__toolbar">
            <div className="forum__segment" role="group" aria-label="Сортировка">
              {([
                ['new', 'Новые'],
                ['active', 'Активные'],
                ['top', 'Топ']
              ] as Array<[SortKey, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={sort === key ? 'is-active' : ''}
                  onClick={() => setSort(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="forum__type-select"
              value={flair}
              onChange={(e) => setFlair(e.target.value)}
              aria-label="Тип поста"
            >
              <option value="">Тип: Все</option>
              {flairs.map((item) => (
                <option key={item} value={item}>
                  Тип: {item}
                </option>
              ))}
            </select>
          </div>

          <div className="forum__layout forum__layout--community">
            <section className="forum__feed">
              {loading && <div className="forum__muted">Загрузка...</div>}
              {posts.map((post) => (
                <ThreadCard
                  key={post.id}
                  post={post}
                  showCommunity={false}
                  onLike={toggleLike}
                  onPin={togglePin}
                  onDelete={deletePost}
                />
              ))}
              {!loading && posts.length === 0 && (
                <div className="forum__muted forum__feed-empty">Постов пока нет.</div>
              )}
            </section>
            <aside className="forum__rail forum__rail--flush forum__rail--about">
              <div className="forum__rail-section">
                <h3 className="forum__rail-label">О сообществе</h3>
                <p className="forum__muted">{community?.description || 'Описание пока не задано.'}</p>
              </div>
              <div className="forum__rail-section">
                <h3 className="forum__rail-label">Модераторы</h3>
                <div className="forum__nav-list">
                  {moderators.map((m, i) => (
                    <div key={i} className="forum__muted">
                      {m.user?.name || m.user?.email || 'Участник'} · {m.role === 'owner' ? 'владелец' : 'модератор'}
                    </div>
                  ))}
                  {moderators.length === 0 && <div className="forum__muted">Нет данных</div>}
                </div>
              </div>
              {community?.createdAt && (
                <div className="forum__muted">Создано {formatForumTime(community.createdAt)}</div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

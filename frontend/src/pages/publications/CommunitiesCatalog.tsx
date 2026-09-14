import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { GuestNavbar } from '../../components/GuestNavbar';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { PlatformIcon } from '../../components/icons';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_FEED_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import { usePageMeta } from '../../hooks/usePageMeta';
import { ImageDropzone } from './ImageDropzone';
import { ThreadCard } from './ThreadCard';
import { DEFAULT_FLAIRS, canCreateForum, type ForumCommunity, type ForumPost } from './forumUtils';
import { toPersistedImageUrl } from '../../lib/publicationImageUpload';
import './communities.css';

type SortKey = 'new' | 'active' | 'top';
type ScopeKey = 'all' | 'subs' | 'mine';

function parseScope(raw: string | null): ScopeKey {
  if (raw === 'subs' || raw === 'mine') return raw;
  return 'all';
}

function parseSort(raw: string | null): SortKey {
  if (raw === 'active' || raw === 'top') return raw;
  return 'new';
}

export default function CommunitiesCatalog() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const scope = parseScope(params.get('scope'));
  const sort = parseSort(params.get('sort'));
  const flair = params.get('flair') || '';

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [managed, setManaged] = useState<ForumCommunity[]>([]);
  const [subscriptions, setSubscriptions] = useState<ForumCommunity[]>([]);
  const [catalog, setCatalog] = useState<ForumCommunity[]>([]);
  const [drafts, setDrafts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);

  usePageMeta({
    title: 'Сообщества',
    description: 'Лента и сообщества JungAI: читайте посты психологов, клиентов и исследователей без регистрации.',
    path: '/communities',
  });

  function setQuery(next: { scope?: ScopeKey; sort?: SortKey; flair?: string }) {
    const nextParams = new URLSearchParams(params);
    const nextScope = next.scope ?? scope;
    const nextSort = next.sort ?? sort;
    const nextFlair = next.flair !== undefined ? next.flair : flair;
    if (nextScope === 'all') nextParams.delete('scope');
    else nextParams.set('scope', nextScope);
    if (nextSort === 'new') nextParams.delete('sort');
    else nextParams.set('sort', nextSort);
    if (!nextFlair) nextParams.delete('flair');
    else nextParams.set('flair', nextFlair);
    setParams(nextParams, { replace: true });
  }

  async function loadRails() {
    if (token) {
      const [discovery, me] = await Promise.all([
        api<{
          managed?: ForumCommunity[];
          subscriptions?: ForumCommunity[];
          communities?: ForumCommunity[];
        }>('/api/publications/discovery', { token }),
        api<{ posts: ForumPost[] }>('/api/publications/me', { token }),
      ]);

      const all = discovery.communities || [];
      const managedList =
        discovery.managed ||
        all.filter((c) => c.currentRole === 'owner' || c.currentRole === 'moderator');
      const subsList =
        discovery.subscriptions ||
        all.filter(
          (c) => c.isSubscribed && c.currentRole !== 'owner' && c.currentRole !== 'moderator'
        );

      setManaged(managedList);
      setSubscriptions(subsList);
      setCatalog(all);
      setDrafts((me.posts || []).filter((p) => p.status === 'draft'));
      return;
    }

    const discovery = await api<{
      items?: ForumPost[];
      communities?: ForumCommunity[];
    }>('/api/public/publications/discovery');
    setManaged([]);
    setSubscriptions([]);
    setCatalog(discovery.communities || []);
    setDrafts([]);
  }

  async function loadFeed() {
    setLoading(true);
    try {
      if (token) {
        const q = new URLSearchParams({ sort, scope });
        if (flair) q.set('flair', flair);
        const res = await api<{ items: ForumPost[] }>(`/api/publications/feed?${q.toString()}`, { token });
        setPosts(res.items || []);
      } else {
        const q = new URLSearchParams({ sort });
        if (flair) q.set('flair', flair);
        const res = await api<{ items: ForumPost[] }>(`/api/public/publications/feed?${q.toString()}`);
        setPosts(res.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRails().catch(() => undefined);
  }, [token]);

  useEffect(() => {
    loadFeed().catch(() => undefined);
  }, [token, sort, scope, flair]);

  async function toggleLike(post: ForumPost) {
    if (!token) {
      setAuthPrompt(true);
      return;
    }
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
        list.map((p) => (p.id === post.id ? { ...p, likedByMe: res.active, reactionsCount: res.reactionsCount } : p))
      );
    } catch {
      setPosts(prev);
    }
  }

  async function togglePin(post: ForumPost) {
    if (!token) return;
    await api(`/api/publications/posts/${post.id}`, {
      method: 'PATCH',
      token,
      body: { isPinned: !post.isPinned }
    });
    await loadFeed();
  }

  async function deletePost(post: ForumPost) {
    if (!token || !post.canDelete) return;
    if (!window.confirm('Удалить пост и все ответы?')) return;
    await api(`/api/publications/posts/${post.id}`, { method: 'DELETE', token });
    setPosts((list) => list.filter((p) => p.id !== post.id));
  }

  async function toggleSub(community: ForumCommunity) {
    if (!token) {
      setAuthPrompt(true);
      return;
    }
    await api(`/api/communities/${community.id}/subscription`, { method: 'POST', token });
    await loadRails();
    if (scope === 'subs') await loadFeed();
  }

  async function createCommunity() {
    if (!token || !name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      const res = await api<{ item: ForumCommunity }>('/api/communities', {
        method: 'POST',
        token,
        body: {
          name: name.trim(),
          description: description.trim(),
          avatarUrl: toPersistedImageUrl(avatarUrl),
          coverUrl: toPersistedImageUrl(coverUrl)
        }
      });
      setShowCreate(false);
      setName('');
      setDescription('');
      setAvatarUrl('');
      setCoverUrl('');
      if (res.item?.slug) navigate(`/publications/community/${res.item.slug}`);
      else await loadRails();
    } finally {
      setSaving(false);
    }
  }

  usePsychologistPlatformTour({
    tourId: 'feed',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && !loading && (user?.role === 'psychologist' || user?.role === 'admin')),
    steps: PSYCHOLOGIST_FEED_TOUR_STEPS
  });

  const catalogOthers = useMemo(
    () => catalog.filter((c) => !c.isSubscribed).slice(0, 5),
    [catalog]
  );
  const catalogTotalOpen = useMemo(() => catalog.filter((c) => !c.isSubscribed).length, [catalog]);

  function communityLink(community: ForumCommunity) {
    return (
      <Link to={`/publications/community/${community.slug}`} className="forum__nav-link">
        <span className="forum__nav-avatar">
          {resolvePublicFileUrl(community.avatarUrl) ? (
            <img src={resolvePublicFileUrl(community.avatarUrl) || ''} alt="" />
          ) : (
            community.name.slice(0, 1)
          )}
        </span>
        <span className="forum__nav-name">{community.name}</span>
      </Link>
    );
  }

  function communityDiscoverRow(community: ForumCommunity) {
    return (
      <div className="forum__nav-row">
        {communityLink(community)}
        <button type="button" className="forum__text-btn" onClick={() => void toggleSub(community)}>
          {community.isSubscribed ? 'Отписка' : 'Подписка'}
        </button>
      </div>
    );
  }

  const emptyText =
    scope === 'subs'
      ? 'В подписках пока нет постов.'
      : scope === 'mine'
        ? 'У вас пока нет опубликованных постов.'
        : 'Лента пока пустая.';

  return (
    <div className="forum">
      {user ? <UniversalNavbar /> : <GuestNavbar />}
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          <header data-tour="feed-header" className="forum__hub-top">
            <div className="forum__hub-title-row">
              <div className="forum__hub-title-block">
                <h1 className="forum__h1 forum__h1--hub">Сообщества</h1>
                {!token ? (
                  <p className="forum__lead forum__lead--hub">
                    Читайте без регистрации. Писать, комментировать и лайкать — после входа.
                  </p>
                ) : null}
              </div>
              <div className="forum__hub-actions">
                {token ? (
                  <PsychologistTourHelpButton
                    tourId="feed"
                    steps={PSYCHOLOGIST_FEED_TOUR_STEPS}
                    userId={user?.id}
                    role={user?.role}
                  />
                ) : null}
                {canCreateForum(user?.role) ? (
                  <Link to="/publications/new" className="forum__new-post">
                    <PlatformIcon name="plus" size={14} strokeWidth={2} />
                    Новый пост
                  </Link>
                ) : (
                  <button type="button" className="forum__new-post" onClick={() => setAuthPrompt(true)}>
                    Войти, чтобы писать
                  </button>
                )}
              </div>
            </div>

            <div className="forum__toolbar">
              <div className="forum__segment" role="group" aria-label="Скоуп ленты">
                {(
                  [
                    ['all', 'Все'],
                    ...(token
                      ? ([
                          ['subs', 'Подписки'],
                          ['mine', 'Мои'],
                        ] as Array<[ScopeKey, string]>)
                      : []),
                  ] as Array<[ScopeKey, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={scope === key ? 'is-active' : ''}
                    onClick={() => {
                      if (!token && key !== 'all') {
                        setAuthPrompt(true);
                        return;
                      }
                      setQuery({ scope: key });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
                    onClick={() => setQuery({ sort: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="forum__type-select"
                value={flair}
                onChange={(e) => setQuery({ flair: e.target.value })}
                aria-label="Тип обсуждения"
              >
                <option value="">Тип: Все</option>
                {DEFAULT_FLAIRS.map((item) => (
                  <option key={item} value={item}>
                    Тип: {item}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="forum__mobile-nav">
            {[...managed, ...subscriptions].slice(0, 12).map((c) => (
              <span key={c.id}>{communityLink(c)}</span>
            ))}
            {managed.length === 0 && subscriptions.length === 0 && (
              <span className="forum__muted">Нет сообществ — откройте каталог ниже</span>
            )}
          </div>

          <div className="forum__layout forum__layout--hub">
            <aside className="forum__rail forum__rail--flush forum__rail--left">
              {token ? (
                <>
                  <div className="forum__rail-section">
                    <h3 className="forum__rail-label">Мои</h3>
                    <div className="forum__nav-list">
                      {managed.map((c) => (
                        <div key={c.id}>{communityLink(c)}</div>
                      ))}
                      {managed.length === 0 && (
                        <p className="forum__muted">Нет сообществ, которыми вы управляете</p>
                      )}
                    </div>
                  </div>
                  <div className="forum__rail-section">
                    <h3 className="forum__rail-label">Подписки</h3>
                    <div className="forum__nav-list">
                      {subscriptions.map((c) => (
                        <div key={c.id}>{communityLink(c)}</div>
                      ))}
                      {subscriptions.length === 0 && (
                        <p className="forum__muted">Пока нет подписок</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
              <div className="forum__rail-section">
                <h3 className="forum__rail-label">{token ? 'Другие' : 'Сообщества'}</h3>
                <div className="forum__nav-list">
                  {catalogOthers.map((c) => (
                    <div key={c.id}>{communityDiscoverRow(c)}</div>
                  ))}
                  {catalogOthers.length === 0 && (
                    <p className="forum__muted">Пока нет открытых сообществ</p>
                  )}
                </div>
                {catalogTotalOpen > 0 && (
                  <Link to="/communities/catalog" className="forum__rail-more">
                    Смотреть весь каталог
                    {catalogTotalOpen > catalogOthers.length ? ` (${catalogTotalOpen})` : ''}
                  </Link>
                )}
              </div>
              {canCreateForum(user?.role) && (
                <button
                  type="button"
                  className="forum__create-link"
                  onClick={() => {
                    if (!token || !canCreateForum(user?.role)) {
                      setAuthPrompt(true);
                      return;
                    }
                    setShowCreate(true);
                  }}
                >                  + Создать сообщество
                </button>
              )}
            </aside>

            <section data-tour="feed-posts" className="forum__feed">
              {loading && <div className="forum__muted">Загрузка...</div>}
              {posts.map((post) => (
                <ThreadCard
                  key={post.id}
                  post={post}
                  onLike={toggleLike}
                  onPin={token ? togglePin : undefined}
                  onDelete={token ? deletePost : undefined}
                />
              ))}
              {!loading && posts.length === 0 && <div className="forum__muted forum__feed-empty">{emptyText}</div>}
            </section>

            <aside data-tour="feed-communities" className="forum__rail forum__rail--flush forum__rail--right">
              {drafts.length > 0 && (
                <div className="forum__rail-section">
                  <h3 className="forum__rail-label">Черновики ({drafts.length})</h3>
                  <div className="forum__nav-list">
                    {drafts.slice(0, 6).map((post) => (
                      <Link key={post.id} to={`/publications/new?id=${post.id}`} className="forum__draft-link">
                        {post.title || 'Без заголовка'}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      {authPrompt && (
        <div className="forum__modal-backdrop" onClick={() => setAuthPrompt(false)}>
          <div className="forum__modal" onClick={(e) => e.stopPropagation()}>
            <div className="forum__modal-title">Только чтение</div>
            <p className="forum__muted">Комментарии, лайки и публикации доступны после входа.</p>
            <div className="forum__actions">
              <button className="forum__text-btn" type="button" onClick={() => setAuthPrompt(false)}>
                Отмена
              </button>
              <button className="forum__new-post" type="button" onClick={() => navigate('/login')}>
                Войти
              </button>
              <button className="forum__new-post" type="button" onClick={() => navigate('/register')}>
                Регистрация
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="forum__modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="forum__modal" onClick={(e) => e.stopPropagation()}>
            <div className="forum__modal-title">Новое сообщество</div>
            <input
              className="forum__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
            />
            <textarea
              className="forum__textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание"
            />
            <ImageDropzone label="Аватар" value={avatarUrl} onChange={setAvatarUrl} kind="avatar" />
            <ImageDropzone label="Обложка" value={coverUrl} onChange={setCoverUrl} kind="cover" />
            <div className="forum__actions">
              <button className="button secondary" type="button" onClick={() => setShowCreate(false)}>
                Отмена
              </button>
              <button className="button" type="button" disabled={saving} onClick={() => void createCommunity()}>
                {saving ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { type ForumCommunity } from './forumUtils';
import './communities.css';

type FilterKey = 'all' | 'open' | 'joined';

export default function CommunitiesDirectory() {
  const { token } = useAuth();
  const [items, setItems] = useState<ForumCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ items: ForumCommunity[] }>('/api/communities', { token });
      setItems(res.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  async function toggleSub(community: ForumCommunity) {
    if (!token) return;
    await api(`/api/communities/${community.id}/subscription`, { method: 'POST', token });
    await load();
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === 'open' && c.isSubscribed) return false;
      if (filter === 'joined' && !c.isSubscribed) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        String(c.description || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, query, filter]);

  return (
    <div className="forum">
      <UniversalNavbar />
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          <header className="forum__hub-top">
            <div className="forum__hub-title-row">
              <div className="forum__hub-title-block">
                <nav className="forum__crumb forum__crumb--inline">
                  <Link to="/communities">Сообщества</Link>
                  <span>→</span>
                  <span>Каталог</span>
                </nav>
                <h1 className="forum__h1 forum__h1--hub">Каталог сообществ</h1>
                <p className="forum__lead forum__lead--hub">Все сообщества платформы. Подпишитесь и читайте посты в ленте.</p>
              </div>
              <Link to="/communities" className="forum__new-post">
                ← К ленте
              </Link>
            </div>

            <div className="forum__toolbar">
              <div className="forum__segment" role="group" aria-label="Фильтр каталога">
                {([
                  ['all', 'Все'],
                  ['open', 'Без подписки'],
                  ['joined', 'Мои подписки']
                ] as Array<[FilterKey, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={filter === key ? 'is-active' : ''}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="forum__search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию"
                aria-label="Поиск сообществ"
              />
            </div>
          </header>

          {loading && <div className="forum__muted">Загрузка...</div>}
          <div className="forum__dir-list">
            {visible.map((community) => {
              const avatar = resolvePublicFileUrl(community.avatarUrl);
              return (
                <article key={community.id} className="forum__dir-row">
                  <Link to={`/publications/community/${community.slug}`} className="forum__dir-main">
                    <span className="forum__nav-avatar forum__nav-avatar--lg">
                      {avatar ? <img src={avatar} alt="" /> : community.name.slice(0, 1)}
                    </span>
                    <span className="forum__dir-copy">
                      <span className="forum__dir-name">{community.name}</span>
                      {community.description ? (
                        <span className="forum__dir-desc">{community.description}</span>
                      ) : null}
                      <span className="forum__dir-meta">
                        {community.membersCount || 0} участников · {community.postsCount || 0} постов
                      </span>
                    </span>
                  </Link>
                  <button type="button" className="forum__text-btn forum__text-btn--strong" onClick={() => void toggleSub(community)}>
                    {community.isSubscribed ? 'Отписка' : 'Подписка'}
                  </button>
                </article>
              );
            })}
            {!loading && visible.length === 0 && (
              <div className="forum__muted forum__feed-empty">Ничего не найдено.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

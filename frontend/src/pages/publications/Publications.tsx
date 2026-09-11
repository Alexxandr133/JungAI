import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_PUBLICATIONS_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import { ThreadCard } from './ThreadCard';
import { canCreateForum, excerptFromHtml, formatForumTime, type ForumCommunity, type ForumPost } from './forumUtils';
import './communities.css';

type MyComment = {
  id: string;
  content: string;
  createdAt: string;
  postId: string;
  post?: { id: string; title: string; status?: string } | null;
};

export default function PublicationsPage() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [communities, setCommunities] = useState<ForumCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'posts' | 'drafts' | 'comments'>('posts');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ posts: ForumPost[]; comments?: MyComment[]; communities: ForumCommunity[] }>(
        '/api/publications/me',
        { token }
      );
      setPosts(res.posts || []);
      setComments(res.comments || []);
      setCommunities(res.communities || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  usePsychologistPlatformTour({
    tourId: 'publications',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && (user?.role === 'psychologist' || user?.role === 'admin')),
    steps: PSYCHOLOGIST_PUBLICATIONS_TOUR_STEPS
  });

  async function publishPost(postId: string) {
    if (!token) return;
    await api(`/api/publications/posts/${postId}/publish`, { method: 'POST', token });
    await load();
  }

  async function deletePost(postId: string) {
    if (!token) return;
    if (!window.confirm('Удалить пост?')) return;
    await api(`/api/publications/posts/${postId}`, { method: 'DELETE', token });
    await load();
  }

  const published = posts.filter((p) => p.status !== 'draft');
  const drafts = posts.filter((p) => p.status === 'draft');
  const visible = tab === 'posts' ? published : tab === 'drafts' ? drafts : [];

  return (
    <div className="forum">
      <UniversalNavbar />
      <main className="forum__main">
        <div className="forum__layout">
          <section data-tour="publications-main" style={{ minWidth: 0 }}>
            <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h1 className="forum__h1">Моё</h1>
                  <p className="forum__lead">Посты, черновики и комментарии — без композера на этой странице.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <PsychologistTourHelpButton
                    tourId="publications"
                    steps={PSYCHOLOGIST_PUBLICATIONS_TOUR_STEPS}
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
              <div className="forum__tabs">
                <button type="button" className={`forum__chip${tab === 'posts' ? ' is-active' : ''}`} onClick={() => setTab('posts')}>
                  Мои посты
                </button>
                <button type="button" className={`forum__chip${tab === 'drafts' ? ' is-active' : ''}`} onClick={() => setTab('drafts')}>
                  Черновики
                </button>
                <button type="button" className={`forum__chip${tab === 'comments' ? ' is-active' : ''}`} onClick={() => setTab('comments')}>
                  Комментарии
                </button>
              </div>
            </div>
            {error && <div className="card" style={{ padding: 12, color: '#ef4444' }}>{error}</div>}
            {loading && <div className="small">Загрузка...</div>}
            {tab !== 'comments' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {visible.map((post) => (
                  <div key={post.id}>
                    <ThreadCard post={post} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Link className="button secondary" to={`/publications/post/${post.id}`}>
                        Открыть
                      </Link>
                      {post.status === 'draft' && (
                        <>
                          <Link className="button secondary" to={`/publications/new?id=${post.id}`}>
                            Редактировать
                          </Link>
                          <button className="button" type="button" onClick={() => void publishPost(post.id)}>
                            Опубликовать
                          </button>
                        </>
                      )}
                      <button className="button secondary" type="button" onClick={() => void deletePost(post.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
                {!loading && visible.length === 0 && (
                  <div className="card" style={{ padding: 20, color: 'var(--text-muted)' }}>
                    {tab === 'drafts' ? 'Черновиков нет.' : 'Постов пока нет.'}
                  </div>
                )}
              </div>
            )}
            {tab === 'comments' && (
              <div style={{ display: 'grid', gap: 10 }}>
                {comments.map((item) => (
                  <Link key={item.id} to={`/publications/post/${item.postId}`} className="card" style={{ padding: 14, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 700 }}>{item.post?.title || 'Пост'}</div>
                    <p className="forum__excerpt" style={{ marginTop: 6 }}>{excerptFromHtml(item.content, 180)}</p>
                    <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                      {formatForumTime(item.createdAt)}
                    </div>
                  </Link>
                ))}
                {!loading && comments.length === 0 && (
                  <div className="card" style={{ padding: 20, color: 'var(--text-muted)' }}>
                    Комментариев нет.
                  </div>
                )}
              </div>
            )}
          </section>
          <aside data-tour="publications-sidebar" className="card forum__rail">
            <h3>Мои сообщества</h3>
            {communities.map((c) => (
              <Link key={c.id} to={`/publications/community/${c.slug}`} className="forum__rail-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontWeight: 700 }}>{c.name}</span>
              </Link>
            ))}
            {communities.length === 0 && <div className="small" style={{ color: 'var(--text-muted)' }}>Нет подписок</div>}
            <Link to="/communities" className="small" style={{ color: 'var(--primary)' }}>
              Каталог
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
